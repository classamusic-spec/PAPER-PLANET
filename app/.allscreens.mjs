import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const OUT='/home/user/PAPER-PLANET/docs/shots'; mkdirSync(OUT,{recursive:true})
const SCREENS = ['title','planet','select','codex','shop','settings','zen']
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true})
const page = await ctx.newPage()
for (const s of SCREENS) {
  const errs=[]
  page.removeAllListeners('pageerror'); page.removeAllListeners('console')
  page.on('pageerror',e=>errs.push('PAGEERROR '+e.message.slice(0,120)))
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))})
  try {
    await page.goto(`http://localhost:3000/?screen=${s}`,{waitUntil:'networkidle',timeout:20000})
    await page.waitForTimeout(1400)
    await page.screenshot({path:`${OUT}/screen-${s}.png`})
    const text = (await page.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').slice(0,110)
    console.log(`${s.padEnd(9)} ✓  "${text}"${errs.length?'  ERR: '+errs[0]:''}`)
  } catch(e){ console.log(`${s.padEnd(9)} ✗  ${String(e).slice(0,100)}`) }
}
await b.close()
