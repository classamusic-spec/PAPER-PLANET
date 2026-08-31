import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { SEED } from './.seed.mjs'
const OUT='/home/user/PAPER-PLANET/docs/shots'; mkdirSync(OUT,{recursive:true})
const SCREENS=['title','planet','select','studio','codex','shop','settings','zen']
const DEVICES=[[390,844,3,'phone'],[1024,1366,2,'tablet'],[844,390,3,'land']]
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let fails=0, allErrs=[]
for (const s of SCREENS) for (const [w,h,dpr,dev] of DEVICES) for (const theme of ['day','night']) {
  const ctx = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,hasTouch:true,isMobile:dev!=='tablet'})
  const page = await ctx.newPage()
  const errs=[]
  page.on('pageerror',e=>errs.push(`${s}/${dev}/${theme}: PAGEERROR ${e.message.slice(0,110)}`))
  page.on('console',m=>{ const t=m.text(); if(m.type()==='error' && !t.includes('Failed to load resource')) errs.push(`${s}/${dev}/${theme}: ${t.slice(0,110)}`) })
  await page.addInitScript(SEED)
  try {
    await page.goto(`http://localhost:3000/?screen=${s}`,{waitUntil:'networkidle',timeout:25000})
    await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t), theme)
    await page.waitForTimeout(1100)
    if (dev==='phone') await page.screenshot({path:`${OUT}/final-${s}-${theme}.png`})
    // accessibility spot checks
    const a11y = await page.evaluate(() => {
      const bad = []
      document.querySelectorAll('button, [role="button"], a[href]').forEach(el => {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim()
        if (!name) bad.push('unnamed control: ' + el.className.slice(0,40))
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return
        // Measure what a finger would actually hit, not the painted box: a
        // control may carry an invisible expander to reach the 44pt minimum.
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        const owns = (x, y) => { const n = document.elementFromPoint(x, y); return !!n && (n === el || el.contains(n)) }
        // The requirement is a 44x44 area centred on the control, no more.
        const halfW = 21, halfH = 21
        const reachH = owns(cx - halfW, cy) && owns(cx + halfW, cy)
        const reachV = owns(cx, cy - halfH) && owns(cx, cy + halfH)
        if (!reachH || !reachV) bad.push(`hit ${Math.round(r.width)}x${Math.round(r.height)}: ` + (name||el.className).slice(0,30))
      })
      const de = document.documentElement
      const overflowX = de.scrollWidth > de.clientWidth + 2
      return { bad: bad.slice(0,4), overflowX }
    })
    const notes=[]
    if (a11y.overflowX) notes.push('H-OVERFLOW')
    if (a11y.bad.length) notes.push(a11y.bad.length+' a11y')
    if (errs.length) { fails++; allErrs.push(...errs) }
    console.log(`${(s+'/'+dev+'/'+theme).padEnd(26)} ${errs.length?'✗':'✓'} ${notes.join(' ')} ${a11y.bad[0]??''}`)
  } catch(e){ fails++; console.log(`${s}/${dev}/${theme} ✗ ${String(e).slice(0,80)}`) }
  await ctx.close()
}
await b.close()
console.log(`\n${fails} failing combinations of ${SCREENS.length*DEVICES.length*2}`)
if (allErrs.length) { console.log('\nUNIQUE ERRORS:'); [...new Set(allErrs)].slice(0,12).forEach(e=>console.log(' ',e)) }
