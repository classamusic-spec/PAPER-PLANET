import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await page.goto('http://localhost:3000/?screen=studio', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const box = await (await page.$('.pp-fold-canvas')).boundingBox()
const cx = box.x+box.width/2, cy = box.y+box.height/2, r = box.width*0.28
await page.mouse.move(cx + r, cy - r); await page.mouse.down()
for (let i = 1; i <= 12; i++) {
  const t = (i/12)*0.45
  await page.mouse.move(cx + r - 2*r*t, cy - r + 2*r*t)
  await page.waitForTimeout(22)
}
await page.mouse.up(); await page.waitForTimeout(500)
console.log(JSON.stringify(await page.evaluate(() => window.__ppCommits ?? ['(none)']), null, 2))
await b.close()
