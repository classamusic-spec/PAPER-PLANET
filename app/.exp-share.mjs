import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
const out = await page.evaluate(async () => {
  const tex = await import('/src/features/share/texture.ts')
  const pal = await import('/src/features/share/palette.ts')
  const p = pal.cardPalette('day', false)
  const blob = async (c) => (await new Promise((r) => c.toBlob(r, 'image/png'))).size
  const mk = () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; return c }
  const rows = []
  let c = mk(); let x = c.getContext('2d'); x.fillStyle = p.paper1; x.fillRect(0,0,1080,1080)
  rows.push('flat: ' + ((await blob(c))/1024).toFixed(0) + ' KB')

  c = mk(); x = c.getContext('2d'); x.fillStyle = p.paper1; x.fillRect(0,0,1080,1080)
  tex.layGrain(x, p, {x:0,y:0,w:1080,h:1080}, 1)
  rows.push('both layers: ' + ((await blob(c))/1024).toFixed(0) + ' KB')

  const g = tex.grainPatterns(x, p)
  c = mk(); x = c.getContext('2d'); x.fillStyle = p.paper1; x.fillRect(0,0,1080,1080)
  const g2 = tex.grainPatterns(x, p)
  x.globalAlpha = p.grainAlpha; x.fillStyle = g2.fine; x.fillRect(0,0,1080,1080)
  rows.push('fine only: ' + ((await blob(c))/1024).toFixed(0) + ' KB')

  c = mk(); x = c.getContext('2d'); x.fillStyle = p.paper1; x.fillRect(0,0,1080,1080)
  const g3 = tex.grainPatterns(x, p)
  x.globalAlpha = p.grainAlpha * 0.72; x.fillStyle = g3.fibre; x.fillRect(0,0,1080,1080)
  rows.push('fibre only: ' + ((await blob(c))/1024).toFixed(0) + ' KB')
  void g
  return rows
})
console.log(out.join('\n'))
await browser.close()
