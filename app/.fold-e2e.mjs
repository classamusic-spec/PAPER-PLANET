/* End-to-end: fold a real species by performing the correct gesture for every step. */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const OUT='/home/user/PAPER-PLANET/docs/shots'; mkdirSync(OUT,{recursive:true})
const SPECIES = process.argv[2] ?? 'crane'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch:true, isMobile:true })
const page = await ctx.newPage()
const errs=[]
page.on('pageerror', e=>errs.push('PAGEERROR '+e.message))
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,180)) })
await page.goto('http://localhost:3000/?screen=studio', { waitUntil:'networkidle' })
await page.waitForTimeout(1200)

const el = await page.$('.pp-fold-canvas')
const box = await el.boundingBox()
const cx = box.x+box.width/2, cy = box.y+box.height/2
const R = box.width*0.30

// Read the live hint (screen space, canvas-local) from the engine frame.
// Mirror the app's own fallback: when prior folds carry both hint anchors onto
// the same point, a real player just drags across the crease.
const hint = () => page.evaluate(() => {
  const f = window.__ppFrame
  if (!f) return null
  let h = f.hint
  const span = h ? Math.hypot(h.to[0]-h.from[0], h.to[1]-h.from[1]) : 0
  if (span < 26 && f.axis) {
    const ax=f.axis.to[0]-f.axis.from[0], ay=f.axis.to[1]-f.axis.from[1]
    const L=Math.hypot(ax,ay)||1, mx=(f.axis.from[0]+f.axis.to[0])/2, my=(f.axis.from[1]+f.axis.to[1])/2
    const nx=-ay/L, ny=ax/L, reach=Math.max(26, L*0.34)
    h = { from:[mx-nx*reach*0.5, my-ny*reach*0.5], to:[mx+nx*reach*0.5, my+ny*reach*0.5] }
  }
  return h ? { fx:h.from[0], fy:h.from[1], tx:h.to[0], ty:h.to[1] } : null
})
const canvasOrigin = () => page.evaluate(() => {
  const r = document.querySelector('.pp-fold-canvas').getBoundingClientRect()
  return { x:r.left, y:r.top }
})
const state = () => page.evaluate(() => ({
  g: document.querySelector('.pp-studio')?.getAttribute('data-gesture'),
  k: document.querySelector('.pp-studio')?.getAttribute('data-kind'),
  c: document.querySelector('.pp-studio__count')?.textContent,
  reveal: !!document.querySelector('.pp-reveal'),
}))

async function perform(g) {
  const h = await hint(); const o = await canvasOrigin()
  if (!h) return
  const fx=o.x+h.fx, fy=o.y+h.fy, tx=o.x+h.tx, ty=o.y+h.ty
  if (g === 'rub') {
    await page.mouse.move(fx, fy); await page.mouse.down()
    for (let pass=0; pass<8; pass++) {
      const [ax,ay,bx,by] = pass%2 ? [tx,ty,fx,fy] : [fx,fy,tx,ty]
      for (let i=1;i<=10;i++){ const t=i/10; await page.mouse.move(ax+(bx-ax)*t, ay+(by-ay)*t); await page.waitForTimeout(9) }
    }
    await page.mouse.up()
  } else if (g === 'hold') {
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(1800); await page.mouse.up()
  } else if (g === 'tap') {
    const tg = await page.evaluate(() => window.__ppFrame?.targets?.[0] ?? null)
    const p = tg ? [o.x + tg[0], o.y + tg[1]] : [fx, fy]
    await page.mouse.click(p[0], p[1])
  } else if (g === 'pinch-in' || g === 'pinch-out' || g === 'twist' || g === 'swipe') {
    // Two-finger gestures need real touch points.
    const dir = g === 'pinch-in' ? -1 : 1
    await page.touchscreen.tap(cx, cy) // ensure focus
    await page.evaluate(({cx,cy,dir,g}) => {
      const el = document.querySelector('.pp-fold-canvas')
      const r = el.getBoundingClientRect()
      const send = (type, pts) => pts.forEach((p,i) => el.dispatchEvent(new PointerEvent(type, {
        pointerId: i+1, pointerType:'touch', isPrimary:i===0, bubbles:true, cancelable:true,
        clientX:p[0], clientY:p[1], pressure:0.5,
      })))
      const c = [r.left+r.width/2, r.top+r.height/2]
      let a=[c[0]-60,c[1]], bpt=[c[0]+60,c[1]]
      send('pointerdown',[a,bpt])
      for (let i=1;i<=18;i++){
        const t=i/18
        if (g==='twist'){ const ang=t*Math.PI/2; const rr=60
          a=[c[0]-Math.cos(ang)*rr, c[1]-Math.sin(ang)*rr]; bpt=[c[0]+Math.cos(ang)*rr, c[1]+Math.sin(ang)*rr] }
        else if (g==='swipe'){ a=[c[0]-60+t*220, c[1]]; bpt=[c[0]+60+t*220, c[1]] }
        else { const s=60+dir*t*55; a=[c[0]-s,c[1]]; bpt=[c[0]+s,c[1]] }
        send('pointermove',[a,bpt])
      }
      send('pointerup',[a,bpt])
    }, {cx,cy,dir,g})
  } else {
    // drag
    await page.mouse.move(fx, fy); await page.mouse.down()
    for (let i=1;i<=26;i++){ const t=i/26; await page.mouse.move(fx+(tx-fx)*t, fy+(ty-fy)*t); await page.waitForTimeout(12) }
    await page.mouse.up()
  }
  await page.waitForTimeout(520)
}

let done=0, stuck=0
for (let n=0; n<24; n++) {
  const s = await state()
  if (s.reveal) { console.log('  → REVEAL reached'); break }
  const before = s.c
  console.log(`  step: ${s.c}  gesture=${s.g} kind=${s.k}`)
  await perform(s.g)
  const after = (await state()).c
  if (after === before) { stuck++; if (stuck>2) { console.log('  !! stuck on', s.g, s.k); break } }
  else { stuck=0; done++ }
}
const fin = await state()
console.log('\nfinal:', JSON.stringify(fin))
await page.screenshot({ path:`${OUT}/fold-e2e-${SPECIES}.png` })
console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].slice(0,6).join('\n') : 'no console errors')
await b.close()
