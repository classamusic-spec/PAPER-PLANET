import { chromium } from 'playwright'

const OUT = '/home/user/PAPER-PLANET/docs/shots'
const now = Date.UTC(2026, 7, 31, 10, 0)
const species = ['crane', 'fox', 'whale', 'orizuru', 'butterfly', 'turtle', 'owl', 'deer', 'bee']
const save = {
  version: 3,
  kami: species.map((id, i) => ({
    uid: 'u' + i, speciesId: id, washiId: 'kozo', nickname: null,
    foldedAt: now - (i + 1) * 86400000 * 9, pos: [0.3 + i * 0.06, 0.6],
    bond: 40 + i * 4, golden: id === 'orizuru', quality: 0.86,
  })),
  folds: Object.fromEntries(species.map((id, i) => [id, 1 + (i % 9)])),
  washi: ['kozo'], activeWashi: 'kozo', sheets: 420, goldLeaf: 12,
  biomes: ['meadow', 'shore', 'forest'],
  daily: { lastFold: null, streak: 3, todaySpecies: null, claimed: true },
  journal: { season: 'season-1', tier: 2, xp: 40, premium: false },
  entitlements: [],
  settings: {
    theme: 'day', reducedMotion: false, highInk: false, assistMode: false, haptics: false,
    volumes: { sfx: 0, ambience: 0, music: 0, master: 0 },
    ambience: 'none', music: false, guides: true, leftHanded: false,
  },
  stats: { totalFolds: 22, totalCreases: 900, studioSeconds: 4000, firstOpenAt: now - 86400000 * 108 },
  seen: [],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({
  viewport: { width: 402, height: 874 }, deviceScaleFactor: 2,
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })

// Stub the Web Share API so the share route can be exercised at all.
await page.addInitScript(({ save }) => {
  localStorage.setItem('paper-planet-save-v3', JSON.stringify(save))
  const log = []
  Object.defineProperty(window, '__shareLog', { get: () => log })
  navigator.canShare = (data) => !!data && Array.isArray(data.files) && data.files.length > 0
  navigator.share = async (data) => {
    log.push({ files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })), text: (data.text ?? '').slice(0, 60) })
  }
}, { save })

await page.goto('http://localhost:3000/?screen=planet', { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)

const planetShare = page.getByRole('button', { name: 'Share your planet' })
console.log('planet affordance:', await planetShare.count(), JSON.stringify(await planetShare.first().boundingBox()))
await page.screenshot({ path: `${OUT}/share-entry-planet.png` })
await planetShare.click()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/share-sheet-planet.png` })

const names = await page.evaluate(() => {
  const d = [...document.querySelectorAll('[role="dialog"]')].pop()
  return [...d.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') ?? b.textContent).trim())
})
console.log('sheet buttons:', JSON.stringify(names))

await page.getByRole('button', { name: /^Share$/ }).click()
await page.waitForTimeout(2500)
console.log('share log:', JSON.stringify(await page.evaluate(() => window.__shareLog)))
await page.screenshot({ path: `${OUT}/share-sheet-planet-after.png` })

// copy route
await page.getByRole('button', { name: /^Copy$/ }).click()
await page.waitForTimeout(2000)
const toast = await page.evaluate(() => [...document.querySelectorAll('[role="status"]')].map((n) => n.textContent.trim()).filter(Boolean))
console.log('status lines:', JSON.stringify(toast))
const clip = await page.evaluate(async () => {
  try {
    const items = await navigator.clipboard.read()
    return items.flatMap((i) => i.types)
  } catch (e) { return ['ERR: ' + e.message] }
})
console.log('clipboard types:', JSON.stringify(clip))
await page.screenshot({ path: `${OUT}/share-sheet-planet-copy.png` })

await browser.close()
