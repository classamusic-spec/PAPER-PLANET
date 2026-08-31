import { chromium } from 'playwright'
import fs from 'node:fs'
const src = process.argv[2]
const pts = JSON.parse(process.argv[3])
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
const b64 = fs.readFileSync(src).toString('base64')
const res = await page.evaluate(async ({ b64, pts }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
  return pts.map(([x, y]) => { const d = ctx.getImageData(x, y, 1, 1).data; return `${x},${y} = rgb(${d[0]},${d[1]},${d[2]})` })
}, { b64, pts })
console.log(res.join('\n'))
await browser.close()
