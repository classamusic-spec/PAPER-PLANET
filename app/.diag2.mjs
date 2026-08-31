import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await (await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch:true, isMobile:true })).newPage()
await page.goto('http://localhost:3000/?screen=studio', { waitUntil:'networkidle' })
await page.waitForTimeout(1200)
const el = await page.$('.pp-fold-canvas'); const box = await el.boundingBox()
const hint = () => page.evaluate(() => { const f=window.__ppFrame; return f?.hint?{fx:f.hint.from[0],fy:f.hint.from[1],tx:f.hint.to[0],ty:f.hint.to[1]}:null })
const org = () => page.evaluate(() => { const r=document.querySelector('.pp-fold-canvas').getBoundingClientRect(); return {x:r.left,y:r.top} })
const st = () => page.evaluate(() => ({ g:document.querySelector('.pp-studio')?.getAttribute('data-gesture'), k:document.querySelector('.pp-studio')?.getAttribute('data-kind'), c:document.querySelector('.pp-studio__count')?.textContent }))
async function drag(){ const h=await hint(), o=await org()
  const fx=o.x+h.fx,fy=o.y+h.fy,tx=o.x+h.tx,ty=o.y+h.ty
  await page.mouse.move(fx,fy); await page.mouse.down()
  for(let i=1;i<=26;i++){ const t=i/26; await page.mouse.move(fx+(tx-fx)*t, fy+(ty-fy)*t); await page.waitForTimeout(12) }
  const dbg = await page.evaluate(()=>window.__ppDbg)
  await page.mouse.up(); await page.waitForTimeout(500)
  return dbg }
async function rub(){ const h=await hint(), o=await org()
  const fx=o.x+h.fx,fy=o.y+h.fy,tx=o.x+h.tx,ty=o.y+h.ty
  await page.mouse.move(fx,fy); await page.mouse.down()
  for(let p=0;p<8;p++){ const [ax,ay,bx,by]=p%2?[tx,ty,fx,fy]:[fx,fy,tx,ty]
    for(let i=1;i<=10;i++){const t=i/10; await page.mouse.move(ax+(bx-ax)*t, ay+(by-ay)*t); await page.waitForTimeout(9)} }
  await page.mouse.up(); await page.waitForTimeout(500) }
// advance to step 4
await rub(); await rub(); await drag(); await drag()
console.log('at:', JSON.stringify(await st()))
const d = await drag()
console.log('mountain drag debug:', JSON.stringify(d, null, 1))
console.log('after:', JSON.stringify(await st()))
await b.close()
