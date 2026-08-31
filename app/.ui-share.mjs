import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '/home/user/PAPER-PLANET/docs/shots'
const theme = process.argv[2] ?? 'day'
const wide = process.argv[3] === 'wide'

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
    theme, reducedMotion: false, highInk: false, assistMode: false, haptics: false,
    volumes: { sfx: 0, ambience: 0, music: 0, master: 0 },
    ambience: 'none', music: false, guides: true, leftHanded: false,
  },
  stats: { totalFolds: 22, totalCreases: 900, studioSeconds: 4000, firstOpenAt: now - 86400000 * 108 },
  seen: [],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({
  viewport: wide ? { width: 1180, height: 900 } : { width: 402, height: 874 },
  deviceScaleFactor: 2,
})
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })

await page.addInitScript(({ save }) => {
  localStorage.setItem('paper-planet-save-v3', JSON.stringify(save))
}, { save })

await page.goto('http://localhost:3000/?screen=codex', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)

// open a species
await page.getByRole('button', { name: /Crane/i }).first().click()
await page.waitForTimeout(700)

const shareBtn = page.getByRole('button', { name: /^Share Crane$/ })
console.log('share affordance count:', await shareBtn.count())
const box = await shareBtn.first().boundingBox()
console.log('share affordance box:', JSON.stringify(box))
await shareBtn.first().click()
await page.waitForTimeout(2200)

await page.screenshot({ path: `${OUT}/share-sheet-${theme}${wide ? '-wide' : ''}.png` })

// accessibility inventory
const audit = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')]
  const dialog = dialogs[dialogs.length - 1] ?? document.body
  const controls = [...dialog.querySelectorAll('button, [role="tab"], canvas')]
  return controls.map((el) => {
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? '',
      name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 70),
      w: Math.round(r.width), h: Math.round(r.height),
    }
  })
})
console.log(JSON.stringify(audit, null, 1))

// switch to story + night paper and shoot again
await page.getByRole('tab', { name: 'Story' }).click()
await page.waitForTimeout(1200)
await page.getByRole('tab', { name: 'Lantern' }).click()
await page.waitForTimeout(1600)
await page.screenshot({ path: `${OUT}/share-sheet-${theme}${wide ? '-wide' : ''}-story.png` })

// exercise Save: intercept the download
const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
await page.getByRole('button', { name: /^Save$/ }).click()
const download = await dl
console.log('download filename:', download ? download.suggestedFilename() : 'NONE')
if (download) {
  const p = `/tmp/claude-0/-home-user-PAPER-PLANET/6fde1b43-4a4b-5058-ad4c-c4a678fc8e51/scratchpad/${download.suggestedFilename()}`
  await download.saveAs(p)
  console.log('saved bytes:', fs.statSync(p).size)
}
await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/share-sheet-${theme}${wide ? '-wide' : ''}-saved.png` })

await browser.close()
