import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const OUT='/home/user/PAPER-PLANET/docs/shots'; mkdirSync(OUT,{recursive:true})
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, hasTouch:true, isMobile:true })
const page = await ctx.newPage()
const errs=[]
page.on('pageerror', e=>errs.push('PAGEERROR '+e.message))
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,200)) })
await page.goto('http://localhost:3000/?screen=studio', { waitUntil:'networkidle' })
await page.waitForTimeout(1400)
const shot=async n=>{ await page.screenshot({path:`${OUT}/studio-${n}.png`}); console.log('✓',n) }
const el = await page.$('.pp-fold-canvas')
if(!el){ console.log('NO CANVAS. body:', (await page.evaluate(()=>document.body.innerText)).slice(0,300)) }
else {
  await shot('real-00')
  console.log('instruction:', await page.$eval('.pp-studio__instruction', e=>e.textContent).catch(()=>'(none)'))
  console.log('count:', await page.$eval('.pp-studio__count', e=>e.textContent).catch(()=>'(none)'))
  const box = await el.boundingBox()
  const cx=box.x+box.width/2, cy=box.y+box.height/2, r=box.width*0.3
  // walk several steps
  for (let s=0; s<4; s++){
    const before = await page.$eval('.pp-studio__count', e=>e.textContent).catch(()=>'')
    await page.mouse.move(cx+r, cy-r); await page.mouse.down()
    for(let i=1;i<=26;i++){ const t=i/26; await page.mouse.move(cx+r-2*r*t, cy-r+2*r*t); await page.waitForTimeout(14) }
    await page.mouse.up(); await page.waitForTimeout(500)
    const after = await page.$eval('.pp-studio__count', e=>e.textContent).catch(()=>'')
    console.log(`  drag ${s}: ${before} -> ${after}`)
  }
  await shot('real-01-progressed')
}
console.log(errs.length? '\nERRORS:\n'+[...new Set(errs)].slice(0,8).join('\n') : '\nno console errors')
await b.close()
