/* Drive the crane to its tap step and its press step, and photograph the lesson. */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const OUT = '/home/user/PAPER-PLANET/docs/shots'
mkdirSync(OUT, { recursive: true })
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const SEED = `(() => {
  localStorage.clear()
  const d = new Date(), p = (n) => String(n).padStart(2,'0')
  const day = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate())
  localStorage.setItem('paper-planet-save-v3', JSON.stringify({
    version:3, kami:[], folds:{}, washi:['kozo'], activeWashi:'kozo',
    sheets: 40, goldLeaf: 0, biomes:['meadow'],
    daily:{ lastFold:null, streak:0, todaySpecies:null, claimed:false },
    journal:{ season:'s1', tier:0, xp:0, premium:false },
    entitlements:[], settings:{},
    stats:{ totalFolds: 3, totalCreases: 20, studioSeconds: 300, firstOpenAt: Date.now()-8.64e7 },
    seen:['onboarded','first-fold','studio-intro','studio-orbit','sys/sparkle-day=' + day, 'sys/sparkle-today=9'],
  }))
})()`

const b = await chromium.launch({ executablePath: EXE })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
for (let a = 0; ; a++) {
  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => navigator.serviceWorker?.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())))
    await page.evaluate(SEED)
    await page.goto('http://localhost:3000/?screen=studio', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.pp-fold-canvas', { timeout: 20000 })
    break
  } catch (e) { if (a >= 3) throw e; await page.waitForTimeout(800) }
}

const state = () => page.evaluate(() => ({
  step: +document.querySelector('.pp-studio').getAttribute('data-step'),
  gesture: document.querySelector('.pp-studio').getAttribute('data-gesture'),
  coach: document.querySelector('.pp-coach')?.getAttribute('data-open'),
  move: document.querySelector('.pp-coach')?.getAttribute('data-move'),
  place: document.querySelector('.pp-coach__place')?.textContent,
  act: document.querySelector('.pp-coach__act')?.textContent,
  ghosts: document.querySelectorAll('.pp-coach__ghost').length,
}))

async function perform(gesture) {
  const geo = await page.evaluate(() => {
    const r = document.querySelector('.pp-fold-canvas').getBoundingClientRect()
    const f = window.__ppFrame
    let hh = f?.hint ?? null
    const span = hh ? Math.hypot(hh.to[0] - hh.from[0], hh.to[1] - hh.from[1]) : 0
    if (span < 26 && f?.axis) {
      const ax = f.axis.to[0] - f.axis.from[0], ay = f.axis.to[1] - f.axis.from[1]
      const L = Math.hypot(ax, ay) || 1
      const mx = (f.axis.from[0] + f.axis.to[0]) / 2, my = (f.axis.from[1] + f.axis.to[1]) / 2
      const nx = -ay / L, ny = ax / L, reach = Math.max(26, L * 0.34)
      hh = { from: [mx - nx * reach * 0.5, my - ny * reach * 0.5], to: [mx + nx * reach * 0.5, my + ny * reach * 0.5] }
    }
    const tg = f?.targets?.[0] ?? null
    return { ox: r.left, oy: r.top, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
             h: hh, tg }
  })
  const { ox, oy } = geo
  if (gesture === 'tap') {
    const p = geo.tg ? [ox + geo.tg[0], oy + geo.tg[1]] : [geo.cx, geo.cy]
    await page.mouse.click(p[0], p[1])
  } else if (gesture === 'hold') {
    await page.mouse.move(geo.cx, geo.cy); await page.mouse.down()
    await page.waitForTimeout(1600); await page.mouse.up()
  } else if (geo.h) {
    const fx = ox + geo.h.from[0], fy = oy + geo.h.from[1], tx = ox + geo.h.to[0], ty = oy + geo.h.to[1]
    if (gesture === 'rub') {
      await page.mouse.move(fx, fy); await page.mouse.down()
      for (let pass = 0; pass < 8; pass++) {
        const [ax, ay, bx, by] = pass % 2 ? [tx, ty, fx, fy] : [fx, fy, tx, ty]
        for (let i = 1; i <= 10; i++) { const t = i / 10; await page.mouse.move(ax + (bx - ax) * t, ay + (by - ay) * t); await page.waitForTimeout(8) }
      }
      await page.mouse.up()
    } else {
      await page.mouse.move(fx, fy); await page.mouse.down()
      for (let i = 1; i <= 26; i++) { const t = i / 26; await page.mouse.move(fx + (tx - fx) * t, fy + (ty - fy) * t); await page.waitForTimeout(11) }
      await page.mouse.up()
    }
  }
  await page.waitForTimeout(620)
}

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }) }

const want = { 4: 'coach-tap-phone-day', 7: 'coach-hold-phone-day' }
for (let n = 0; n < 20; n++) {
  const s = await state()
  if (s.step >= 8) break
  if (want[s.step]) {
    /* sit still: the teacher should offer itself after ~6.5s */
    await page.waitForTimeout(7600)
    const t = await state()
    console.log(`step ${t.step} (${t.gesture}) → coach=${t.coach} move=${t.move} ghosts=${t.ghosts} :: ${t.place} / ${t.act}`)
    await shot(want[s.step])
    delete want[s.step]
  }
  console.log(`  performing step ${s.step}: ${s.gesture}`)
  await perform(s.gesture)
  const after = await state()
  if (after.step === s.step) { console.log('  !! stuck'); break }
}
await b.close()
console.log('done')
