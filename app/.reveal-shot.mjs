import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [w,h,dpr,label] of [[390,844,3,'phone'],[1024,1366,2,'tablet']]) {
 for (const theme of ['day','night']) {
  const page = await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,hasTouch:true,isMobile:label==='phone'})).newPage()
  await page.goto('http://localhost:3000/?screen=studio',{waitUntil:'networkidle'}); await page.waitForTimeout(1000)
  await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t), theme)
  const org=()=>page.evaluate(()=>{const r=document.querySelector('.pp-fold-canvas').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}})
  const raw=()=>page.evaluate(()=>{const f=window.__ppFrame;return{hint:f?.hint,axis:f?.axis,targets:f?.targets}})
  const gst=()=>page.evaluate(()=>document.querySelector('.pp-studio')?.dataset.gesture)
  const hint=async()=>{const f=await raw(),o=await org();let hh=f.hint
    const span=hh?Math.hypot(hh.to[0]-hh.from[0],hh.to[1]-hh.from[1]):0
    if(span<26&&f.axis){const ax=f.axis.to[0]-f.axis.from[0],ay=f.axis.to[1]-f.axis.from[1],L=Math.hypot(ax,ay)||1
      const mx=(f.axis.from[0]+f.axis.to[0])/2,my=(f.axis.from[1]+f.axis.to[1])/2,nx=-ay/L,ny=ax/L,re=Math.max(26,L*0.34)
      hh={from:[mx-nx*re*0.5,my-ny*re*0.5],to:[mx+nx*re*0.5,my+ny*re*0.5]}}
    return{h:hh,o,f}}
  for(let i=0;i<12;i++){
    const g = await gst(); if(!g) break
    const {h,o,f}=await hint(); if(!h) break
    const fx=o.x+h.from[0],fy=o.y+h.from[1],tx=o.x+h.to[0],ty=o.y+h.to[1]
    if(g==='rub'){await page.mouse.move(fx,fy);await page.mouse.down()
      for(let p=0;p<8;p++){const[ax,ay,bx,by]=p%2?[tx,ty,fx,fy]:[fx,fy,tx,ty]
        for(let k=1;k<=10;k++){const t=k/10;await page.mouse.move(ax+(bx-ax)*t,ay+(by-ay)*t);await page.waitForTimeout(8)}}
      await page.mouse.up()}
    else if(g==='hold'){await page.mouse.move(o.x+o.w/2,o.y+o.h/2);await page.mouse.down();await page.waitForTimeout(1900);await page.mouse.up()}
    else if(g==='tap'){const tg=f.targets?.[0];const p=tg?[o.x+tg[0],o.y+tg[1]]:[fx,fy];await page.mouse.click(p[0],p[1])}
    else{await page.mouse.move(fx,fy);await page.mouse.down()
      for(let k=1;k<=24;k++){const t=k/24;await page.mouse.move(fx+(tx-fx)*t,fy+(ty-fy)*t);await page.waitForTimeout(10)}
      await page.mouse.up()}
    await page.waitForTimeout(480)
  }
  await page.waitForTimeout(1800)
  const ok = await page.evaluate(()=>!!document.querySelector('.pp-reveal'))
  await page.screenshot({path:`/home/user/PAPER-PLANET/docs/shots/reveal-${label}-${theme}.png`})
  console.log(`✓ reveal-${label}-${theme}  reveal=${ok}`)
  await page.close()
 }
}
await b.close()
