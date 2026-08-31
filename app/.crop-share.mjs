import { chromium } from 'playwright'
import fs from 'node:fs'
const [src, x, y, w, h, out, scale] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
const b64 = fs.readFileSync(src).toString('base64')
const res = await page.evaluate(async ({ b64, x, y, w, h, scale }) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const c = document.createElement('canvas')
  c.width = w * scale; c.height = h * scale
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, x, y, w, h, 0, 0, w * scale, h * scale)
  return c.toDataURL('image/png').split(',')[1]
}, { b64, x: +x, y: +y, w: +w, h: +h, scale: +(scale ?? 3) })
fs.writeFileSync(out, Buffer.from(res, 'base64'))
console.log('wrote', out)
await browser.close()
