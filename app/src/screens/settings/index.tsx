/* PAPER PLANET — Settings. A paper form, not a list of OS switches. */

import { useCallback, useRef, useState } from 'react'
import type { AmbienceId, AudioBus, Settings } from '../../contracts'
import { actions, useAtelier, useSettings, useStorefrontOpen } from '../../systems'
import { audio } from '../../audio'
import { useNavigation } from '../../shell/Navigator'
import { Button, Icon, IconButton, Slider, Toggle, useToast } from '../../ui'
import { Choice, Field, Section } from './Controls'
import { useAudioSettings, useBusPreview } from './audioSettings'
import './settings.css'

/** A fader reads as a level, and zero reads as a decision. */
const level = (v: number): string => (v <= 0 ? 'Off' : `${Math.round(v * 100)}%`)

const AMBIENCE: { value: AmbienceId; label: string }[] = [
  { value: 'meadow', label: 'Meadow' },
  { value: 'rain', label: 'Rain' },
  { value: 'shore', label: 'Shore' },
  { value: 'night', label: 'Night' },
  { value: 'tearoom', label: 'Tea room' },
  { value: 'none', label: 'Silence' },
]

export default function SettingsScreen() {
  const nav = useNavigation()
  const settings = useSettings()
  const atelier = useAtelier()
  const shopOpen = useStorefrontOpen()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useAudioSettings(settings)
  const preview = useBusPreview()

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    actions.updateSettings({ [key]: value } as Partial<Settings>)
    audio.play('ui.toggle')
  }, [])

  /**
   * Move a fader and hear that fader. Paper for Everything and Paper, a note
   * for Music, and for Room the bed itself — which is already playing, so the
   * slider moves the real room live and only needs a sample of its own when
   * the player has chosen silence.
   */
  const setVolume = useCallback(
    (bus: AudioBus, value: number) => {
      actions.setVolume(bus, value)
      preview(bus)
    },
    [preview],
  )

  const exportSave = useCallback(() => {
    const json = actions.exportSaveJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paper-planet-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.show({ title: 'Saved to your device.', note: 'Keep it somewhere safe.' })
  }, [toast])

  const importSave = useCallback(
    async (file: File) => {
      const text = await file.text()
      const ok = actions.importSaveJson(text)
      toast.show({
        title: ok ? 'Brought back.' : 'That file did not read.',
        note: ok ? 'Everything is where you left it.' : 'Nothing was changed.',
      })
    },
    [toast],
  )

  return (
    <div className="pp-set">
      <header className="pp-set__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <h1>Settings</h1>
        <div className="pp-set__spacer" />
      </header>

      <div className="pp-set__scroll">
        <Section title="The desk" note="How the paper is lit." icon="sun" seed="look" tilt={-0.5}>
          <Field label="Light" hint="Night keeps the paper and dims the room.">
            <Choice
              label="Light"
              value={settings.theme}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'night', label: 'Night' },
                { value: 'auto', label: 'Auto', note: 'Follows your device' },
              ]}
              onChange={(v) => set('theme', v)}
            />
          </Field>
          <Field label="High ink" hint="Heavier outlines and stronger contrast.">
            <Toggle checked={settings.highInk} onChange={(v) => set('highInk', v)} label="High ink" />
          </Field>
          <Field label="Fold guides" hint="The dashed crease line and the hint arrow. Off is expert folding.">
            <Toggle checked={settings.guides} onChange={(v) => set('guides', v)} label="Fold guides" />
          </Field>
        </Section>

        <Section title="Your hands" note="How folding responds to you." icon="hand" seed="hands" tilt={0.6}>
          <Field
            label="Assist mode"
            hint="Tap to fold instead of dragging. Every fold stays available; nothing is made easier or worth less."
          >
            <Toggle checked={settings.assistMode} onChange={(v) => set('assistMode', v)} label="Assist mode" />
          </Field>
          <Field label="Left-handed" hint="Puts the controls under your other thumb.">
            <Toggle checked={settings.leftHanded} onChange={(v) => set('leftHanded', v)} label="Left-handed" />
          </Field>
          <Field label="Haptics" hint="A small tap in time with every crease.">
            <Toggle checked={settings.haptics} onChange={(v) => set('haptics', v)} label="Haptics" />
          </Field>
          <Field label="Reduced motion" hint="Stills the drifting, the breathing and the parallax.">
            <Toggle
              checked={settings.reducedMotion}
              onChange={(v) => set('reducedMotion', v)}
              label="Reduced motion"
            />
          </Field>
        </Section>

        <Section title="Sound" note="The paper is the point. The rest is a room." icon="sound-on" seed="sound" tilt={-0.4}>
          <Field label="Everything" hint="Move any of these and you will hear what you are setting." stacked>
            <Slider
              label="Everything"
              ariaLabel="Master volume"
              value={settings.volumes.master}
              min={0}
              max={1}
              step={0.05}
              format={level}
              onChange={(v) => setVolume('master', v)}
            />
          </Field>
          <Field label="Paper" hint="Creases, folds, the rub of your finger. The instrument." stacked>
            <Slider
              label="Paper"
              ariaLabel="Paper volume"
              value={settings.volumes.sfx}
              min={0}
              max={1}
              step={0.05}
              format={level}
              onChange={(v) => setVolume('sfx', v)}
            />
          </Field>
          <Field label="Room" hint="The bed under everything. It stays behind the paper at any setting." stacked>
            <Slider
              label="Room"
              ariaLabel="Ambience volume"
              value={settings.volumes.ambience}
              min={0}
              max={1}
              step={0.05}
              format={level}
              onChange={(v) => setVolume('ambience', v)}
            />
          </Field>
          <Field label="Music" hint="Sparse notes, far back. Quiet enough to forget it is there." stacked>
            <Slider
              label="Music"
              ariaLabel="Music volume"
              value={settings.volumes.music}
              min={0}
              max={1}
              step={0.05}
              format={level}
              onChange={(v) => setVolume('music', v)}
            />
          </Field>
          <Field label="Ambience" hint="A bed under everything. Silence is a real choice." stacked>
            <Choice
              label="Ambience"
              layout="wrap"
              value={settings.ambience}
              options={AMBIENCE}
              onChange={(v) => set('ambience', v)}
            />
          </Field>
          <Field label="Play music" hint="Sparse notes, never a loop you can hear.">
            <Toggle checked={settings.music} onChange={(v) => set('music', v)} label="Music" />
          </Field>
        </Section>

        <Section title="Your things" note="This save lives on this device." icon="sheets" seed="data" tilt={0.4}>
          <Field label="Save a copy" hint="A file you can keep, move, or bring to another device." stacked>
            <Button variant="quiet" size="sm" onClick={exportSave}>
              <Icon name="share" size={14} /> Export
            </Button>
          </Field>
          <Field label="Bring one back" hint="Replaces what is here now." stacked>
            <>
              <Button variant="quiet" size="sm" onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={14} /> Import
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="pp-set__file"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importSave(f)
                  e.target.value = ''
                }}
              />
            </>
          </Field>
          <Field label="Purchases" hint="Brings back anything bought on this account." stacked>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                void actions.restorePurchases().then((ids) =>
                  toast.show({
                    title: ids.length ? 'Restored.' : 'Nothing to restore.',
                  }),
                )
              }}
            >
              Restore purchases
            </Button>
          </Field>
          <Field label="Start over" hint="Every Kami, every fold, every paper. This cannot be undone." stacked>
            {confirmReset ? (
              <div className="pp-set__confirm">
                <Button
                  variant="beni"
                  size="sm"
                  onClick={() => {
                    actions.resetEverything()
                    setConfirmReset(false)
                    toast.show({ title: 'A fresh sheet.' })
                    nav.reset('title')
                  }}
                >
                  Yes, start over
                </Button>
                <Button variant="quiet" size="sm" onClick={() => setConfirmReset(false)}>
                  Keep my things
                </Button>
              </div>
            ) : (
              <Button variant="quiet" size="sm" onClick={() => setConfirmReset(true)}>
                Start over
              </Button>
            )}
          </Field>
        </Section>

        {/* BRAND section 12: exactly one line about the Atelier, and only once
            the storefront is legitimately open. */}
        {shopOpen && !atelier && (
          <p className="pp-set__atelier">
            The Atelier opens every Washi and every ambience.{' '}
            <button type="button" onClick={() => nav.push('shop')}>
              Have a look
            </button>
          </p>
        )}

        <footer className="pp-set__about">
          <p>PAPER PLANET</p>
          <p>Fold. Breathe. Come alive.</p>
        </footer>
      </div>
    </div>
  )
}
