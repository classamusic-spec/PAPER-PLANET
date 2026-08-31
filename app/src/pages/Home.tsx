import { useState } from 'react'
import TitleScreen from '../components/TitleScreen'
import SelectScreen from '../components/SelectScreen'
import FoldScreen from '../components/FoldScreen'
import PlanetScreen from '../components/PlanetScreen'
import BookScreen from '../components/BookScreen'
import { getAnimal } from '../game/animals'
import { useSave, rollSparkle } from '../game/store'
import { setMuted, isMuted, sfx, startBgm, stopBgm } from '../game/audio'

type Screen = 'title' | 'select' | 'fold' | 'planet' | 'book'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('title')
  const [animalId, setAnimalId] = useState<string>('crane')
  const [sparkle, setSparkle] = useState(false)
  const { data, addFriend, addGold, recordFold, feed } = useSave()
  const [mutedUi, setMutedUi] = useState(isMuted())

  const toggleMute = () => {
    const next = !mutedUi
    setMuted(next)
    setMutedUi(next)
    if (next) stopBgm()
    else {
      startBgm()
      sfx.sparkle()
    }
  }

  const startFolding = (id: string) => {
    setAnimalId(id)
    setSparkle(rollSparkle(data.folds[id] ?? 0))
    setScreen('fold')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--paper)' }}>
      <div key={screen} style={{ position: 'absolute', inset: 0, animation: 'screenfade .35s ease both' }}>
        {screen === 'title' && (
          <TitleScreen
            hasFriends={data.collection.length > 0}
            onPlay={() => setScreen('select')}
            onPlanet={() => setScreen('planet')}
          />
        )}
        {screen === 'select' && (
          <SelectScreen
            collection={data.collection}
            gold={data.gold}
            onPick={startFolding}
            onBack={() => setScreen('title')}
          />
        )}
        {screen === 'fold' && (
          <FoldScreen
            animal={getAnimal(animalId)}
            sparkle={sparkle}
            onAlive={(wasSparkle) => {
              addFriend(animalId)
              recordFold(animalId)
              if (wasSparkle) addGold(animalId)
            }}
            onDone={() => setScreen('planet')}
            onBack={() => setScreen('select')}
          />
        )}
        {screen === 'planet' && (
          <PlanetScreen
            collection={data.collection}
            gold={data.gold}
            onFeed={feed}
            onFold={() => setScreen('select')}
            onBook={() => setScreen('book')}
            onHome={() => setScreen('title')}
          />
        )}
        {screen === 'book' && (
          <BookScreen collection={data.collection} gold={data.gold} hearts={data.hearts} onBack={() => setScreen('planet')} />
        )}
      </div>

      {/* global sound toggle */}
      <button
        onClick={toggleMute}
        aria-label={mutedUi ? 'Unmute' : 'Mute'}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 50,
          width: 46,
          height: 46,
          borderRadius: 14,
          background: 'var(--sticker)',
          border: '3px solid var(--ink)',
          boxShadow: '3px 3px 0 var(--ink)',
          fontSize: '1.2rem',
          cursor: 'pointer',
        }}
      >
        {mutedUi ? '🔇' : '🔊'}
      </button>
      <style>{`@keyframes screenfade { from { opacity: 0; transform: scale(1.03); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  )
}
