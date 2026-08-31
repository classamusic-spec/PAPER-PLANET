// PAPER PLANET — perspective camera: orbit (yaw/pitch/roll/zoom), projection, and fit().

import type { CameraPose } from '../contracts'
import type { Mat34 } from './geom'
import { DEG, clamp, finite, matApplyDir, matCreate, matIdentity, matMul, matSetRotAxis } from './geom'

/**
 * A long lens. Paper photographed at 28 degrees keeps its edges straight and
 * reads as a product shot rather than a video game.
 */
export const FOV_Y = 28 * DEG
const MIN_Z = 8

/**
 * Model space is screen-shaped: x right, y DOWN, z out of the sheet toward the
 * viewer. Pitch tilts the far edge away, so pitch 0 looks straight at the sheet
 * and larger pitch looks down at it lying on the desk.
 */
export class OrbitCamera {
  yaw = 0
  pitch = 0
  roll = 0
  zoom = 1

  /** Viewport in CSS pixels. */
  vw = 1
  vh = 1
  /** Pixels of focal length. */
  focal = 1
  /** Orbit centre in world space. */
  tx = 0
  ty = 0
  tz = 0
  /** Eye distance that frames the model at zoom 1. */
  fitDist = 2400
  /** Bounding radius captured at the last fit(). */
  fitRadius = 760

  private view: Mat34 = matCreate()
  private rx: Mat34 = matCreate()
  private ry: Mat34 = matCreate()
  private rz: Mat34 = matCreate()
  private dirty = true

  setPose(p: Partial<CameraPose>): void {
    if (p.yaw !== undefined) this.yaw = clamp(finite(p.yaw, 0), -720, 720)
    if (p.pitch !== undefined) this.pitch = clamp(finite(p.pitch, 0), -89, 89)
    if (p.roll !== undefined) this.roll = clamp(finite(p.roll, 0), -720, 720)
    if (p.zoom !== undefined) this.zoom = clamp(finite(p.zoom, 1), 0.15, 8)
    this.dirty = true
  }

  getPose(): CameraPose {
    return { yaw: this.yaw, pitch: this.pitch, roll: this.roll, zoom: this.zoom }
  }

  setViewport(w: number, h: number): void {
    this.vw = Math.max(1, finite(w, 1))
    this.vh = Math.max(1, finite(h, 1))
    this.focal = this.vh * 0.5 / Math.tan(FOV_Y * 0.5)
    this.dirty = true
  }

  /**
   * Coarse fallback: frame a bounding sphere. Safe from any angle but wastes
   * roughly 40% of the viewport, so it is only the starting guess for fitTo().
   */
  fit(cx: number, cy: number, cz: number, radius: number, w: number, h: number, pad = 1.12): void {
    this.setViewport(w, h)
    this.tx = finite(cx, 0)
    this.ty = finite(cy, 0)
    this.tz = finite(cz, 0)
    const r = Math.max(finite(radius, 1), 1)
    this.fitRadius = r
    this.fitDist = Math.max(r * 1.25, (r * pad) / Math.sin(this.halfAngle()))
    this.dirty = true
  }

  /**
   * Frame the model tightly.
   *
   * Solves for the eye distance that makes the projected model fill `fill` of
   * the viewport, by measuring the actual projection and correcting — four
   * passes converge to well under a pixel. Feed it yaw-swept proxy points
   * (Sheet.fitProxies) and the framing holds at any yaw, so the player can orbit
   * without the model wandering out of frame.
   */
  fitTo(
    pts: Float64Array, count: number,
    cx: number, cy: number, cz: number,
    w: number, h: number, fill: number,
  ): void {
    this.setViewport(w, h)
    this.tx = finite(cx, 0)
    this.ty = finite(cy, 0)
    this.tz = finite(cz, 0)

    let r2 = 0
    for (let i = 0; i < count; i++) {
      const dx = pts[i * 3] - this.tx
      const dy = pts[i * 3 + 1] - this.ty
      const dz = pts[i * 3 + 2] - this.tz
      const d = dx * dx + dy * dy + dz * dz
      if (d > r2) r2 = d
    }
    const r = Math.max(Math.sqrt(r2), 1)
    this.fitRadius = r
    this.dirty = true
    this.update()

    const f = clamp(finite(fill, 0.82), 0.2, 0.99)
    const targetX = this.vw * 0.5 * f
    const targetY = this.vh * 0.5 * f
    let d = Math.max(r * 1.25, r / Math.sin(this.halfAngle()))

    for (let pass = 0; pass < 4; pass++) {
      let mx = 1e-6
      let my = 1e-6
      const m = this.view
      for (let i = 0; i < count; i++) {
        const x = pts[i * 3]
        const y = pts[i * 3 + 1]
        const z = pts[i * 3 + 2]
        const vx = m[0] * x + m[1] * y + m[2] * z + m[3]
        const vy = m[4] * x + m[5] * y + m[6] * z + m[7]
        const vz = m[8] * x + m[9] * y + m[10] * z + m[11]
        const zc = Math.max(MIN_Z, d - vz)
        const k = this.focal / zc
        const ax = Math.abs(vx * k)
        const ay = Math.abs(vy * k)
        if (ax > mx) mx = ax
        if (ay > my) my = ay
      }
      const scale = Math.max(mx / targetX, my / targetY)
      if (!(scale > 0) || !Number.isFinite(scale)) break
      d = clamp(d * clamp(scale, 0.25, 4), r * 1.05 + MIN_Z, 1e7)
      if (Math.abs(scale - 1) < 0.002) break
    }
    this.fitDist = d
    this.dirty = true
  }

  private halfAngle(): number {
    const halfX = Math.atan((this.vw * 0.5) / this.focal)
    return Math.max(0.02, Math.min(FOV_Y * 0.5, halfX))
  }

  /** Eye distance after zoom. */
  get dist(): number {
    return Math.max(this.fitRadius * 1.05 + MIN_Z, this.fitDist / this.zoom)
  }

  update(): void {
    if (!this.dirty) return
    this.dirty = false
    matSetRotAxis(this.ry, 0, 1, 0, this.yaw * DEG)
    matSetRotAxis(this.rx, 1, 0, 0, this.pitch * DEG)
    matSetRotAxis(this.rz, 0, 0, 1, this.roll * DEG)
    matIdentity(this.view)
    matMul(this.rx, this.ry, this.view)
    matMul(this.rz, this.view, this.view)
    // Fold the orbit-centre translation into the last column.
    const m = this.view
    const tx = this.tx
    const ty = this.ty
    const tz = this.tz
    m[3] = -(m[0] * tx + m[1] * ty + m[2] * tz)
    m[7] = -(m[4] * tx + m[5] * ty + m[6] * tz)
    m[11] = -(m[8] * tx + m[9] * ty + m[10] * tz)
  }

  /**
   * World -> screen. Writes [sx, sy, depth] where depth is the distance in
   * front of the eye: smaller is nearer the camera.
   */
  project(x: number, y: number, z: number, out: Float64Array, oi: number): void {
    const m = this.view
    const vx = m[0] * x + m[1] * y + m[2] * z + m[3]
    const vy = m[4] * x + m[5] * y + m[6] * z + m[7]
    const vz = m[8] * x + m[9] * y + m[10] * z + m[11]
    const d = this.dist - vz
    const zc = d > MIN_Z ? d : MIN_Z
    const k = this.focal / zc
    out[oi] = this.vw * 0.5 + vx * k
    out[oi + 1] = this.vh * 0.5 + vy * k
    out[oi + 2] = zc
  }

  /** Unit vector from the origin toward the eye, in world space. */
  viewDir(out: Float64Array, oi: number): void {
    // The eye sits at +z in view space, so the world direction is the third row
    // of the (orthonormal) view rotation, read as a column of its inverse.
    const m = this.view
    out[oi] = m[8]
    out[oi + 1] = m[9]
    out[oi + 2] = m[10]
  }

  /** Rotate a world direction into view space — used for stable layer offsets. */
  toView(x: number, y: number, z: number, out: Float64Array, oi: number): void {
    matApplyDir(this.view, x, y, z, out, oi)
  }
}
