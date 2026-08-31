import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await (await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch:true, isMobile:true })).newPage()
await page.goto('http://localhost:3000/?screen=studio', { waitUntil:'networkidle' })
await page.waitForTimeout(1200)
const org = () => page.evaluate(()=>{const r=document.querySelector('.pp-fold-canvas').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}})
const raw = () => page.evaluate(()=>{const f=window.__ppFrame; return { hint:f?.hint, axis:f?.axis, facets:f?.facets?.length, bounds:f?.bounds }})
const st = () => page.evaluate(()=>({g:document.querySelector('.pp-studio')?.getAttribute('data-gesture'),k:document.querySelector('.pp-studio')?.getAttribute('data-kind'),c:document.querySelector('.pp-studio__count')?.textContent}))
const hint = async () => { const f = await raw(); const o = await org()
  let h=f.hint; const span=h?Math.hypot(h.to[0]-h.from[0],h.to[1]-h.from[1]):0
  if(span<26 && f.axis){const ax=f.axis.to[0]-f.axis.from[0],ay=f.axis.to[1]-f.axis.from[1],L=Math.hypot(ax,ay)||1
    const mx=(f.axis.from[0]+f.axis.to[0])/2,my=(f.axis.from[1]+f.axis.to[1])/2,nx=-ay/L,ny=ax/L,reach=Math.max(26,L*0.34)
    h={from:[mx-nx*reach*0.5,my-ny*reach*0.5],to:[mx+nx*reach*0.5,my+ny*reach*0.5]}}
  return {h,o} }
async function drag(){ const {h,o}=await hint()
  const fx=o.x+h.from[0],fy=o.y+h.from[1],tx=o.x+h.to[0],ty=o.y+h.to[1]
  await page.mouse.move(fx,fy); await page.mouse.down()
  for(let i=1;i<=26;i++){const t=i/26; await page.mouse.move(fx+(tx-fx)*t, fy+(ty-fy)*t); await page.waitForTimeout(12)}
  const dbg=await page.evaluate(()=>window.__ppDbg)
  await page.mouse.up(); await page.waitForTimeout(500); return {dbg,fx,fy,tx,ty} }
async function rub(){ const {h,o}=await hint()
  const fx=o.x+h.from[0],fy=o.y+h.from[1],tx=o.x+h.to[0],ty=o.y+h.to[1]
  await page.mouse.move(fx,fy); await page.mouse.down()
  for(let p=0;p<8;p++){const[ax,ay,bx,by]=p%2?[tx,ty,fx,fy]:[fx,fy,tx,ty]
    for(let i=1;i<=10;i++){const t=i/10;await page.mouse.move(ax+(bx-ax)*t,ay+(by-ay)*t);await page.waitForTimeout(9)}}
  await page.mouse.up(); await page.waitForTimeout(500) }
await rub(); await drag(); await drag()
console.log('at step:', JSON.stringify(await st()))
console.log('canvas:', JSON.stringify(await org()))
console.log('raw frame:', JSON.stringify(await raw()).slice(0,400))
const r = await drag()
console.log('drag coords:', JSON.stringify({fx:r.fx|0,fy:r.fy|0,tx:r.tx|0,ty:r.ty|0}))
console.log('dbg:', JSON.stringify(r.dbg))
console.log('after:', JSON.stringify(await st()))
await b.close()
