import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
const out = await page.evaluate(async () => {
  const [render, data, content] = await Promise.all([
    import('/src/features/share/render.ts'),
    import('/src/features/share/data.ts'),
    import('/src/content/index.ts'),
  ])
  const now = Date.UTC(2026, 7, 31)
  const species = content.getSpecies('crane')
  const card = data.specimenCard({ species, instance: { uid:'d', speciesId:'crane', washiId:'kozo', nickname:null, foldedAt:now, pos:[0,0], bond:50, golden:false, quality:0.9 }, folds: 4, now })
  const rows = []
  for (const [shape, ratio] of [['square',1],['square',2],['story',1],['story',2]]) {
    const b = await render.renderCardBlob(card, { shape, theme: 'day', highInk: false, pixelRatio: ratio })
    rows.push(`${shape} @${ratio}x -> ${(b.size/1048576).toFixed(2)} MB`)
  }
  return rows
})
console.log(out.join('\n'))
await browser.close()
