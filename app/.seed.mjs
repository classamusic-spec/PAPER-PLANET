/* Seed a realistic save so screens aren't tested in their empty state. */
export const SEED = `(() => {
  const now = Date.now()
  const sp = ['crane','butterfly','rabbit','fox','frog','ladybug','fish','owl','snail','heron','bee','turtle']
  const kami = sp.map((id,i) => ({
    uid: 'k'+i, speciesId: id, washiId: 'kozo', nickname: null,
    foldedAt: now - (sp.length-i)*86400000,
    pos: [0.18 + (i%4)*0.21, 0.30 + Math.floor(i/4)*0.2],
    bond: 40 + (i*7)%55, golden: i===2||i===7, quality: 0.6 + (i%5)*0.08,
  }))
  const folds = {}
  sp.forEach((id,i) => { folds[id] = [1,1,3,3,5,10,2,12,1,4,26,7][i] ?? 2 })
  localStorage.setItem('paper-planet-save-v3', JSON.stringify({
    version:3, kami, folds,
    washi:['kozo','beni-zome','asanoha-ai','sakura-fubuki'], activeWashi:'kozo',
    sheets: 1240, goldLeaf: 14,
    biomes:['meadow','shore','forest'],
    daily:{ lastFold:null, streak:6, todaySpecies:null, claimed:false },
    journal:{ season:'s1', tier:4, xp:60, premium:false },
    entitlements:[], settings:{}, 
    stats:{ totalFolds: 71, totalCreases: 480, studioSeconds: 5400, firstOpenAt: now-30*86400000 },
    seen:['onboarded','first-fold'],
  }))
})()`
