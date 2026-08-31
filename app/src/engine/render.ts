// PAPER PLANET — facet -> RenderFrame: transform, micro-thickness, shade, depth-sort, project.

import type { RenderFacet, RenderFrame, Vec2 } from '../contracts'
import type { Sheet } from './sheet'
import type { OrbitCamera } from './camera'
import type { Shader } from './shade'
import { closureOf, foldOcclusion } from './shade'
import { THICKNESS } from './types'
import { bendExponent, bendVertex } from './bend'
import {
  EPS, clamp01, convexHull, finite, newellNormal, offsetPolygon, sideDist, smoothstep,
} from './geom'

/** Extra depth credited per stacked layer when two facets are coplanar. */
const LAYER_BIAS = 0.42
/** How far a fully inflated facet balloons, model units. */
const INFLATE_AMP = 96
/** Softening of the contact shadow, model units. */
const SHADOW_SPREAD = 14

type MutVec2 = [number, number]

const EMPTY_POLY: readonly number[] = []

/**
 * A RenderFacet plus one additive field.
 *
 * `RenderFacet` is frozen, so this widens it rather than changing it: any
 * consumer typed against `RenderFacet` keeps working untouched.
 *
 * `internal` marks a piece of *tessellation* rather than a piece of paper — the
 * strips a bending flap is sliced into, and the triangles an inflated facet is
 * fanned into. Their shared borders are not creases and must never be drawn as
 * edges, or a smooth bow turns into corrugated iron. The engine already sets
 * `stroke: null` on them so a renderer that just honours `stroke` is correct by
 * default; the flag is there for renderers that want to decide for themselves.
 */
export interface PaperFacet extends RenderFacet {
  internal: boolean
}

/** A RenderFrame whose facets carry the `internal` flag. */
export interface PaperFrame extends RenderFrame {
  facets: PaperFacet[]
}

/** Per-frame options the engine hands the renderer. */
export interface RenderOptions {
  /** Material-space hint anchors for the current step. */
  hintFrom: Vec2 | null
  hintTo: Vec2 | null
  /** Material-space tap targets. */
  targets: readonly Vec2[]
  /** Material-space crease axis of the current step. */
  axisFrom: Vec2 | null
  axisTo: Vec2 | null
  /** Draw a contact shadow on the desk. */
  shadow: boolean
}

export class Renderer {
  /** Set false to skip the contact-shadow hull entirely (reduced-motion / low-end). */
  shadows = true

  private sheet: Sheet
  private camera: OrbitCamera
  private shader: Shader

  // ── drawable buffers, all grown geometrically and never freed ─────────────
  private wbuf = new Float64Array(4096)
  private sbuf = new Float64Array(4096)
  private dStart = new Int32Array(256)
  private dCount = new Int32Array(256)
  private dFacet = new Int32Array(256)
  private dNorm = new Float64Array(768)
  private dKey = new Float64Array(256)
  private dLayer = new Float64Array(256)
  private dRootMin = new Float64Array(256)
  private dRootMid = new Float64Array(256)
  private dLocal: (readonly number[])[] = []
  private dInternal = new Uint8Array(256)
  private nodeInv = new Float64Array(64)
  private nodePocket = new Float64Array(64)
  private dId: string[] = []
  private order = new Int32Array(256)
  private orderLen = 0

  private pool: PaperFacet[] = []
  private ptsPool: MutVec2[][] = []
  private outFacets: PaperFacet[] = []

  private shadowPts: number[] = []
  private shadowHull: number[] = []
  private shadowOut: number[] = []
  private shadowScreen: MutVec2[] = []
  private shadowVersion = -1
  private shadowZ = 0

  private hintFrom: MutVec2 = [0, 0]
  private hintTo: MutVec2 = [0, 0]
  private hintBox: { from: Vec2; to: Vec2 } = { from: this.hintFrom, to: this.hintTo }
  private axisFrom: MutVec2 = [0, 0]
  private axisTo: MutVec2 = [0, 0]
  private axisBox: { from: Vec2; to: Vec2 } = { from: this.axisFrom, to: this.axisTo }
  private targetPool: MutVec2[] = []
  private targetsOut: MutVec2[] = []

  private frame: PaperFrame = {
    facets: this.outFacets,
    shadow: this.shadowScreen,
    hint: null,
    targets: this.targetsOut,
    axis: null,
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  }

  private v3 = new Float64Array(3)
  private p3 = new Float64Array(3)
  private breathCenter = new Float64Array(3)
  private breathVersion = -1
  private lookup = new Map<number, number>()
  private lookupVersion = -1

  constructor(sheet: Sheet, camera: OrbitCamera, shader: Shader) {
    this.sheet = sheet
    this.camera = camera
    this.shader = shader
  }

  /* ── the frame ─────────────────────────────────────────────────────────── */

  render(opts: RenderOptions): PaperFrame {
    const sheet = this.sheet
    const cam = this.camera
    sheet.updateWorld()
    cam.update()

    const facets = sheet.facets
    const nodes = sheet.nodes
    const nf = facets.length

    // Which way is "up off the desk" right now — the image of the sheet normal.
    const rootW = nodes[0].world
    const upx = rootW[2]
    const upy = rootW[6]
    const upz = rootW[10]
    cam.viewDir(this.v3, 0)
    const vx = this.v3[0]
    const vy = this.v3[1]
    const vz = this.v3[2]

    const inflate = clamp01(sheet.inflate)
    const breathAmp = sheet.breathAmp
    const breathPhase = sheet.breathPhase
    let bcx = 0
    let bcy = 0
    let bcz = 0
    if (breathAmp > 0) {
      if (this.breathVersion !== sheet.geomVersion) {
        this.breathVersion = sheet.geomVersion
        sheet.measure(this.breathCenter)
      }
      bcx = this.breathCenter[0]
      bcy = this.breathCenter[1]
      bcz = this.breathCenter[2]
    }

    // ── pass 1: count drawables and vertices ──────────────────────────────
    let dn = 0
    let vn = 0
    for (let i = 0; i < nf; i++) {
      const f = facets[i]
      const node = nodes[f.node]
      if (node.inFlight && node.bow > EPS && f.strips) {
        const st = f.strips
        for (let k = 0; k < st.length; k++) {
          dn++
          vn += st[k].poly.length >> 1
        }
      } else if (inflate > EPS && f.fan) {
        dn += f.fan.tris.length
        vn += f.fan.tris.length * 3
      } else {
        dn++
        vn += f.poly.length >> 1
      }
    }
    this.ensure(dn, vn)

    // ── pass 2: build world vertices ──────────────────────────────────────
    const wbuf = this.wbuf
    const dStart = this.dStart
    const dCount = this.dCount
    const dFacet = this.dFacet
    const dId = this.dId
    let d = 0
    let vp = 0
    let minZ = Infinity

    for (let i = 0; i < nf; i++) {
      const f = facets[i]
      const node = nodes[f.node]
      const bending = node.inFlight && node.bow > EPS && f.strips !== null

      if (bending && f.strips) {
        const pw = sheet.flightParentWorld(f.node)
        const ux0 = node.bx - node.ax
        const uy0 = node.by - node.ay
        const ul = Math.sqrt(ux0 * ux0 + uy0 * uy0)
        const ux = ul > EPS ? ux0 / ul : 1
        const uy = ul > EPS ? uy0 / ul : 0
        const exp = bendExponent(node.bow)
        const theta = finite(node.angle, 0)
        const st = f.strips
        for (let k = 0; k < st.length; k++) {
          const sp = st[k]
          const n = sp.poly.length >> 1
          dStart[d] = vp / 3
          dCount[d] = n
          dFacet[d] = i
          dId[d] = sp.id
          this.dLocal[d] = sp.poly
          this.dInternal[d] = 1
          for (let q = 0; q < n; q++) {
            bendVertex(
              sp.poly[q * 2], sp.poly[q * 2 + 1], 0, sp.s[q],
              node.ax, node.ay, ux, uy, theta, exp, this.p3, 0,
            )
            const lx = this.p3[0]
            const ly = this.p3[1]
            const lz = this.p3[2]
            wbuf[vp] = pw[0] * lx + pw[1] * ly + pw[2] * lz + pw[3]
            wbuf[vp + 1] = pw[4] * lx + pw[5] * ly + pw[6] * lz + pw[7]
            wbuf[vp + 2] = pw[8] * lx + pw[9] * ly + pw[10] * lz + pw[11]
            vp += 3
          }
          d++
        }
        continue
      }

      const m = node.world
      if (inflate > EPS && f.fan) {
        const fan = f.fan
        const amp = fan.dir * inflate * INFLATE_AMP
        for (let k = 0; k < fan.tris.length; k++) {
          const tri = fan.tris[k]
          const w = fan.w[k]
          dStart[d] = vp / 3
          dCount[d] = 3
          dFacet[d] = i
          dId[d] = fan.ids[k]
          this.dLocal[d] = tri
          this.dInternal[d] = 1
          for (let q = 0; q < 3; q++) {
            const lx = tri[q * 2]
            const ly = tri[q * 2 + 1]
            const lz = w[q] * amp
            wbuf[vp] = m[0] * lx + m[1] * ly + m[2] * lz + m[3]
            wbuf[vp + 1] = m[4] * lx + m[5] * ly + m[6] * lz + m[7]
            wbuf[vp + 2] = m[8] * lx + m[9] * ly + m[10] * lz + m[11]
            vp += 3
          }
          d++
        }
        continue
      }

      const p = f.poly
      const n = p.length >> 1
      dStart[d] = vp / 3
      dCount[d] = n
      dFacet[d] = i
      dId[d] = f.id
      this.dLocal[d] = p
      this.dInternal[d] = 0
      for (let q = 0; q < n; q++) {
        const lx = p[q * 2]
        const ly = p[q * 2 + 1]
        wbuf[vp] = m[0] * lx + m[1] * ly + m[3]
        wbuf[vp + 1] = m[4] * lx + m[5] * ly + m[7]
        wbuf[vp + 2] = m[8] * lx + m[9] * ly + m[11]
        vp += 3
      }
      d++
    }

    // ── pass 2b: distance from each drawable to its own hinge ─────────────
    // Ambient occlusion at a fold root is about how deep into the crevice a
    // piece of paper sits, so it has to be measured per DRAWABLE, not per facet:
    // the strip hugging the crease is in shadow while the free edge of the same
    // flap is in full light.
    if (this.nodeInv.length < nodes.length) {
      this.nodeInv = new Float64Array(nodes.length * 2)
      this.nodePocket = new Float64Array(nodes.length * 2)
    }
    const nodeInv = this.nodeInv
    const nodePocket = this.nodePocket
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i]
      // Nodes are always appended after their parent, so one forward pass
      // accumulates "how many closed folds am I underneath".
      nodePocket[i] = nd.parent < 0 ? 0 : nodePocket[nd.parent] + closureOf(nd.angle)
      if (nd.parent < 0) {
        nodeInv[i] = 0
        continue
      }
      const ex = nd.bx - nd.ax
      const ey = nd.by - nd.ay
      const el = Math.sqrt(ex * ex + ey * ey)
      nodeInv[i] = el > EPS ? 1 / el : 0
    }
    const dRootMin = this.dRootMin
    const dRootMid = this.dRootMid
    for (let k = 0; k < d; k++) {
      const f = facets[dFacet[k]]
      const nd = nodes[f.node]
      const inv = nodeInv[f.node]
      if (inv === 0) {
        dRootMin[k] = 1e9
        dRootMid[k] = 1e9
        continue
      }
      const p = this.dLocal[k]
      let mn = Infinity
      let sum = 0
      let cnt = 0
      for (let q = 0; q < p.length; q += 2) {
        const dd = Math.abs(sideDist(p[q], p[q + 1], nd.ax, nd.ay, nd.bx, nd.by, inv))
        if (dd < mn) mn = dd
        sum += dd
        cnt++
      }
      dRootMin[k] = cnt ? mn : 1e9
      dRootMid[k] = cnt ? sum / cnt : 1e9
    }

    // ── pass 3: breathe, normals, micro-thickness, projection ─────────────
    const sbuf = this.sbuf
    const dNorm = this.dNorm
    const dKey = this.dKey
    const dLayer = this.dLayer
    const layerScale = sheet.layerScale
    const maxLayer = sheet.maxLayer()
    // One flatness blend for the whole step, so the stack re-indexes as a unit.
    let flightAngle = 0
    let anyFlight = false
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].inFlight) continue
      anyFlight = true
      const a = Math.abs(nodes[i].angle)
      if (a > flightAngle) flightAngle = a
    }
    const flatBlend = anyFlight
      ? smoothstep((140 * Math.PI) / 180, (175 * Math.PI) / 180, flightAngle)
      : 1

    for (let k = 0; k < d; k++) {
      const s0 = dStart[k]
      const cnt = dCount[k]
      const f = facets[dFacet[k]]
      const node = nodes[f.node]

      if (breathAmp > 0) {
        // Soft phase lag by fold depth, so the breath ripples out through the model.
        const kb = 1 + breathAmp * Math.sin((breathPhase - node.depth * 0.045) * Math.PI * 2)
        for (let q = 0; q < cnt; q++) {
          const b = (s0 + q) * 3
          wbuf[b] = bcx + (wbuf[b] - bcx) * kb
          wbuf[b + 1] = bcy + (wbuf[b + 1] - bcy) * kb
          wbuf[b + 2] = bcz + (wbuf[b + 2] - bcz) * kb
        }
      }

      newellNormal(wbuf, s0 * 3, cnt, dNorm, k * 3)
      const nx = dNorm[k * 3]
      const ny = dNorm[k * 3 + 1]
      const nz = dNorm[k * 3 + 2]

      // Layer index blends to its post-fold value as the fold lies flat, so the
      // stack reorders without a pop.
      const layer = f.layer + (f.layerFlat - f.layer) * flatBlend
      dLayer[k] = layer

      // Micro-thickness: push each stacked sheet along its own normal, choosing
      // the sign that points away from the desk. Edge-on flaps have no useful
      // desk direction, so they lean toward the camera instead — which is also
      // the order they need to draw in.
      let w = nx * upx + ny * upy + nz * upz
      if (w < 0.3 && w > -0.3) w += 0.5 * (nx * vx + ny * vy + nz * vz)
      const off = (w >= 0 ? 1 : -1) * layer * THICKNESS * layerScale
      if (off !== 0) {
        for (let q = 0; q < cnt; q++) {
          const b = (s0 + q) * 3
          wbuf[b] += nx * off
          wbuf[b + 1] += ny * off
          wbuf[b + 2] += nz * off
        }
      }

      let sz = 0
      for (let q = 0; q < cnt; q++) {
        const b = (s0 + q) * 3
        const wz = wbuf[b + 2]
        if (wz < minZ) minZ = wz
        cam.project(wbuf[b], wbuf[b + 1], wz, sbuf, b)
        sz += sbuf[b + 2]
      }
      sz /= cnt
      // Painter's key: distance from the eye, minus a nudge per stacked layer so
      // coplanar sheets resolve by their place in the stack.
      dKey[k] = sz - layer * LAYER_BIAS
    }

    // ── pass 4: depth sort (frame-coherent insertion sort) ────────────────
    this.sortDrawables(d)

    // ── pass 5: emit ──────────────────────────────────────────────────────
    const out = this.outFacets
    out.length = d
    const shader = this.shader
    const aoStrength = shader.light.ao
    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity

    for (let k = 0; k < d; k++) {
      const src = this.order[k]
      const rf = this.pool[src]
      const pts = this.ptsPool[src]
      const s0 = dStart[src]
      const cnt = dCount[src]
      const f = facets[dFacet[src]]
      const node = nodes[f.node]

      if (pts.length !== cnt) {
        while (pts.length < cnt) pts.push([0, 0])
        pts.length = cnt
      }
      for (let q = 0; q < cnt; q++) {
        const b = (s0 + q) * 3
        const px = sbuf[b]
        const py = sbuf[b + 1]
        const t = pts[q]
        t[0] = px
        t[1] = py
        if (px < bx0) bx0 = px
        if (px > bx1) bx1 = px
        if (py < by0) by0 = py
        if (py > by1) by1 = py
      }

      const nx = dNorm[src * 3]
      const ny = dNorm[src * 3 + 1]
      const nz = dNorm[src * 3 + 2]
      // Two occlusion values, both real: the average across the piece is baked
      // into the fill, while the value at the fold root is reported so the
      // renderer can lay a gradient along the crease seam.
      const above = maxLayer - dLayer[src]
      const pocket = nodePocket[f.node]
      const occlMean = foldOcclusion(dRootMid[src], node.angle, pocket, above, aoStrength)
      const occlSeam = foldOcclusion(dRootMin[src], node.angle, pocket, above, aoStrength)
      const sh = shader.shade(nx, ny, nz, vx, vy, vz, occlMean)

      const internal = this.dInternal[src] === 1
      rf.id = dId[src]
      rf.points = pts
      rf.fill = sh.fill
      // Tessellation seams are not paper edges. Never stroke them.
      rf.stroke = internal ? null : sh.stroke
      rf.internal = internal
      rf.strokeWidth = shader.strokeWidth
      rf.sheen = sh.sheen
      rf.depth = -dKey[src]
      rf.isBack = nx * vx + ny * vy + nz * vz < 0
      rf.occlusion = occlSeam
      out[k] = rf
    }

    // ── shadow, hints, axis, bounds ───────────────────────────────────────
    const shadow = this.buildShadow(opts.shadow && this.shadows, d, minZ)
    for (let i = 0; i < shadow.length; i++) {
      const p = shadow[i]
      if (p[0] < bx0) bx0 = p[0]
      if (p[0] > bx1) bx1 = p[0]
      if (p[1] < by0) by0 = p[1]
      if (p[1] > by1) by1 = p[1]
    }

    const frame = this.frame
    frame.facets = out
    frame.shadow = shadow
    frame.hint = this.projectPair(opts.hintFrom, opts.hintTo, this.hintFrom, this.hintTo)
      ? this.hintBox
      : null
    frame.axis = this.projectPair(opts.axisFrom, opts.axisTo, this.axisFrom, this.axisTo)
      ? this.axisBox
      : null

    const tg = this.targetsOut
    tg.length = 0
    for (let i = 0; i < opts.targets.length; i++) {
      if (this.targetPool.length <= i) this.targetPool.push([0, 0])
      const slot = this.targetPool[i]
      if (this.projectMaterial(opts.targets[i], slot)) tg.push(slot)
    }

    if (bx0 > bx1) {
      bx0 = 0
      by0 = 0
      bx1 = 0
      by1 = 0
    }
    frame.bounds.x = bx0
    frame.bounds.y = by0
    frame.bounds.w = bx1 - bx0
    frame.bounds.h = by1 - by0
    return frame
  }

  /** Deep copy of the last frame, for callers that need to retain it. */
  snapshot(frame: PaperFrame): PaperFrame {
    return {
      facets: frame.facets.map((f) => ({ ...f, points: f.points.map((p) => [p[0], p[1]] as Vec2) })),
      shadow: frame.shadow.map((p) => [p[0], p[1]] as Vec2),
      hint: frame.hint
        ? { from: [frame.hint.from[0], frame.hint.from[1]], to: [frame.hint.to[0], frame.hint.to[1]] }
        : null,
      targets: frame.targets.map((p) => [p[0], p[1]] as Vec2),
      axis: frame.axis
        ? { from: [frame.axis.from[0], frame.axis.from[1]], to: [frame.axis.to[0], frame.axis.to[1]] }
        : null,
      bounds: { ...frame.bounds },
    }
  }

  /* ── internals ─────────────────────────────────────────────────────────── */

  /**
   * Painter's algorithm. The order barely changes frame to frame, so an
   * insertion sort seeded with the previous order runs in near-linear time —
   * far cheaper than a comparator sort, and stable, so coplanar facets never
   * flicker between orderings.
   */
  private sortDrawables(d: number): void {
    const order = this.order
    if (this.orderLen !== d) {
      for (let i = 0; i < d; i++) order[i] = i
      this.orderLen = d
    }
    const key = this.dKey
    const layer = this.dLayer
    // Descending key: furthest from the eye first.
    for (let i = 1; i < d; i++) {
      const v = order[i]
      const kv = key[v]
      const lv = layer[v]
      let j = i - 1
      while (j >= 0) {
        const u = order[j]
        const ku = key[u]
        if (ku > kv) break
        if (ku === kv) {
          const lu = layer[u]
          if (lu < lv || (lu === lv && u < v)) break
        }
        order[j + 1] = u
        j--
      }
      order[j + 1] = v
    }
  }

  private ensure(dn: number, vn: number): void {
    if (this.wbuf.length < vn * 3) {
      const n = 1 << (32 - Math.clz32(Math.max(1, vn * 3 - 1)))
      this.wbuf = new Float64Array(n)
      this.sbuf = new Float64Array(n)
    }
    if (this.dStart.length < dn) {
      const n = 1 << (32 - Math.clz32(Math.max(1, dn - 1)))
      this.dStart = new Int32Array(n)
      this.dCount = new Int32Array(n)
      this.dFacet = new Int32Array(n)
      this.dNorm = new Float64Array(n * 3)
      this.dKey = new Float64Array(n)
      this.dLayer = new Float64Array(n)
      this.dRootMin = new Float64Array(n)
      this.dRootMid = new Float64Array(n)
      this.dInternal = new Uint8Array(n)
      this.order = new Int32Array(n)
      this.orderLen = -1
    }
    while (this.dId.length < dn) this.dId.push('')
    while (this.dLocal.length < dn) this.dLocal.push(EMPTY_POLY)
    while (this.pool.length < dn) {
      const pts: MutVec2[] = []
      this.ptsPool.push(pts)
      this.pool.push({
        id: '',
        points: pts,
        fill: '#f7ede0',
        stroke: null,
        strokeWidth: 0.75,
        sheen: 0,
        depth: 0,
        isBack: false,
        occlusion: 0,
        internal: false,
      })
    }
  }

  /**
   * Contact shadow: the model's silhouette cast onto the desk along the key
   * light, hulled and softened. Camera-independent, so it is cached in desk
   * coordinates and only rebuilt when the geometry actually changes.
   */
  private buildShadow(want: boolean, d: number, minZ: number): MutVec2[] {
    const out = this.shadowScreen
    if (!want || d === 0) {
      out.length = 0
      return out
    }
    const sheet = this.sheet
    const L = this.shader.light
    if (Math.abs(L.lz) < 0.15) {
      out.length = 0
      return out
    }
    if (this.shadowVersion !== sheet.geomVersion) {
      this.shadowVersion = sheet.geomVersion
      this.shadowZ = Math.min(0, finite(minZ, 0)) - 1.5
      const pts = this.shadowPts
      pts.length = 0
      const wbuf = this.wbuf
      let total = 0
      for (let k = 0; k < d; k++) {
        const s0 = this.dStart[k]
        const cnt = this.dCount[k]
        for (let q = 0; q < cnt; q++) {
          const b = (s0 + q) * 3
          const t = (wbuf[b + 2] - this.shadowZ) / L.lz
          pts.push(wbuf[b] - L.lx * t, wbuf[b + 1] - L.ly * t)
          total++
        }
      }
      convexHull(pts, total, this.shadowHull)
      offsetPolygon(this.shadowHull, SHADOW_SPREAD, this.shadowOut)
    }

    const hull = this.shadowOut
    const n = hull.length >> 1
    while (out.length < n) out.push([0, 0])
    out.length = n
    const z = this.shadowZ
    for (let i = 0; i < n; i++) {
      this.camera.project(hull[i * 2], hull[i * 2 + 1], z, this.p3, 0)
      out[i][0] = this.p3[0]
      out[i][1] = this.p3[1]
    }
    return out
  }

  /** Material-space point -> screen, following the facet that currently owns it. */
  /**
   * A material-space point, in screen space — or false when the point is not on
   * any facet. Public because a caller sometimes needs a point the current step
   * does not name: a crease whose two authored endpoints have been folded onto
   * each other projects to nothing, and the only way back is to ask for other
   * points along the same line.
   */
  projectPoint(p: Vec2, out: MutVec2): boolean {
    return this.projectMaterial(p, out)
  }

  private projectMaterial(p: Vec2 | null, out: MutVec2): boolean {
    if (!p) return false
    const sheet = this.sheet
    if (this.lookupVersion !== sheet.geomVersion) {
      this.lookup.clear()
      this.lookupVersion = sheet.geomVersion
    }
    const u = finite(p[0], 500)
    const v = finite(p[1], 500)
    const key = (Math.round(u * 4) << 14) ^ Math.round(v * 4)
    let fi = this.lookup.get(key)
    if (fi === undefined) {
      fi = sheet.facetAtMaterial(u, v)
      this.lookup.set(key, fi)
    }
    if (fi < 0 || fi >= sheet.facets.length) return false
    const m = sheet.nodes[sheet.facets[fi].node].world
    const lx = u - 500
    const ly = v - 500
    const wx = m[0] * lx + m[1] * ly + m[3]
    const wy = m[4] * lx + m[5] * ly + m[7]
    const wz = m[8] * lx + m[9] * ly + m[11]
    this.camera.project(wx, wy, wz, this.p3, 0)
    out[0] = this.p3[0]
    out[1] = this.p3[1]
    return true
  }

  private projectPair(a: Vec2 | null, b: Vec2 | null, oa: MutVec2, ob: MutVec2): boolean {
    if (!a || !b) return false
    return this.projectMaterial(a, oa) && this.projectMaterial(b, ob)
  }
}
