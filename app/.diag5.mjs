import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true})).newPage()
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERROR '+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))})
await page.goto('http://localhost:3000/?screen=studio',{waitUntil:'networkidle'}); await page.waitForTimeout(1200)
// jump straight to the last step by seeking: drive the engine via the DOM is hard,
// so just fast-path: simulate completing by holding on the press step after seeking.
const st=()=>page.evaluate(()=>{const e=document.querySelector('.pp-studio');return e?{phase:e.dataset.phase,complete:e.dataset.complete,step:e.dataset.step,g:e.dataset.gesture}:{reveal:!!document.querySelector('.pp-reveal')}})
const org=()=>page.evaluate(()=>{const r=document.querySelector('.pp-fold-canvas').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}})
const raw=()=>page.evaluate(()=>{const f=window.__ppFrame;return{hint:f?.hint,axis:f?.axis,targets:f?.targets}})
const hint=async()=>{const f=await raw(),o=await org();let h=f.hint
  const span=h?Math.hypot(h.to[0]-h.from[0],h.to[1]-h.from[1]):0
  if(span<26&&f.axis){const ax=f.axis.to[0]-f.axis.from[0],ay=f.axis.to[1]-f.axis.from[1],L=Math.hypot(ax,ay)||1
    const mx=(f.axis.from[0]+f.axis.to[0])/2,my=(f.axis.from[1]+f.axis.to[1])/2,nx=-ay/L,ny=ax/L,re=Math.max(26,L*0.34)
    h={from:[mx-nx*re*0.5,my-ny*re*0.5],to:[mx+nx*re*0.5,my+ny*re*0.5]}}
  return{h,o,f}}
async function step(g){const{h,o,f}=await hint()
  const fx=o.x+h.from[0],fy=o.y+h.from[1],tx=o.x+h.to[0],ty=o.y+h.to[1]
  if(g==='rub'){await page.mouse.move(fx,fy);await page.mouse.down()
    for(let p=0;p<8;p++){const[ax,ay,bx,by]=p%2?[tx,ty,fx,fy]:[fx,fy,tx,ty]
      for(let i=1;i<=10;i++){const t=i/10;await page.mouse.move(ax+(bx-ax)*t,ay+(by-ay)*t);await page.waitForTimeout(9)}}
    await page.mouse.up()}
  else if(g==='hold'){await page.mouse.move(o.x+o.w/2,o.y+o.h/2);await page.mouse.down();await page.waitForTimeout(2000);await page.mouse.up()}
  else if(g==='tap'){const tg=f.targets?.[0];const p=tg?[o.x+tg[0],o.y+tg[1]]:[fx,fy];await page.mouse.click(p[0],p[1])}
  else{await page.mouse.move(fx,fy);await page.mouse.down()
    for(let i=1;i<=26;i++){const t=i/26;await page.mouse.move(fx+(tx-fx)*t,fy+(ty-fy)*t);await page.waitForTimeout(12)}
    await page.mouse.up()}
  await page.waitForTimeout(520)}
for(let i=0;i<12;i++){const s=await st(); if(s.reveal||!s.phase||s.complete==='true')break
  console.log(i, JSON.stringify(s)); await step(s.g)}
await page.waitForTimeout(1500)
console.log('FINAL:', JSON.stringify(await st()))
console.log('has .pp-reveal:', await page.evaluate(()=>!!document.querySelector('.pp-reveal')))
console.log('phase log:', JSON.stringify(await page.evaluate(()=>window.__ppPhase??[])))
console.log(errs.length?'ERRORS:\n'+[...new Set(errs)].slice(0,6).join('\n'):'no console errors')
await b.close()
