import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { SEED } from './.seed.mjs'
const OUT='/home/user/PAPER-PLANET/docs/shots'; mkdirSync(OUT,{recursive:true})
const screens = (process.argv[2] ?? 'codex').split(',')
const devices = [[390,844,3,'phone'],[1024,1366,2,'tablet']]
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const s of screens) for (const [w,h,dpr,label] of devices) for (const theme of ['day','night']) {
  const ctx = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,hasTouch:true,isMobile:label==='phone'})
  const page = await ctx.newPage()
  const errs=[]
  page.on('pageerror',e=>errs.push('PAGEERROR '+e.message.slice(0,140)))
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))})
  await page.addInitScript(SEED)
  await page.goto(`http://localhost:3000/?screen=${s}`,{waitUntil:'networkidle',timeout:25000})
  await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t), theme)
  await page.waitForTimeout(1500)
  await page.screenshot({path:`${OUT}/${s}-${label}-${theme}.png`})
  console.log(`✓ ${s}-${label}-${theme}${errs.length?'  ERR: '+errs[0]:''}`)
  await ctx.close()
}
await b.close()
