// PAPER PLANET — the live component gallery. Every component, variant and state, both themes.

import { useEffect, useState } from 'react'
import type { AccentToken } from '../contracts'
import {
  Button,
  Chip,
  Crane,
  CraneMark,
  Currency,
  Icon,
  ICON_NAMES,
  IconButton,
  Logotype,
  Meter,
  Paper,
  Reveal,
  Sheet,
  Slider,
  Stagger,
  Tabs,
  Toggle,
  ToastProvider,
  useToast,
} from './index'
import type { EdgeKind } from './index'

const ACCENTS: AccentToken[] = ['beni', 'kincha', 'matcha', 'ai', 'murasaki', 'sakura', 'gold-leaf', 'ink']
const EDGES: EdgeKind[] = ['clean', 'cut', 'deckle', 'torn']

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--s-12)' }}>
      <div style={{ marginBottom: 'var(--s-4)' }}>
        <h2 style={{ fontSize: 'var(--fs-display-m)' }}>{title}</h2>
        {note ? (
          <p style={{ color: 'var(--ink)', opacity: 0.78, fontSize: 'var(--fs-body)', marginTop: 4 }}>{note}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--s-3)', alignItems: 'center' }

function ToastDemo() {
  const toast = useToast()
  return (
    <div style={row}>
      <Button
        variant="matcha"
        size="sm"
        icon="check"
        onClick={() => toast.show({ title: 'The crease holds.', note: 'Mastery: Adept', icon: 'check', accent: 'matcha' })}
      >
        Confirm slip
      </Button>
      <Button
        variant="gold-leaf"
        size="sm"
        icon="goldleaf"
        onClick={() => toast.show({ title: '3 Gold Leaf', note: 'From the Daily Fold', icon: 'goldleaf', accent: 'gold-leaf' })}
      >
        Reward slip
      </Button>
    </div>
  )
}

export function Gallery() {
  const [tab, setTab] = useState('studio')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [sound, setSound] = useState(true)
  const [assist, setAssist] = useState(false)
  const [volume, setVolume] = useState(0.62)
  const [guides, setGuides] = useState(3)
  const [purse, setPurse] = useState(1240)

  /* the count-up is part of the design, so the gallery must actually exercise it */
  useEffect(() => {
    const t = window.setTimeout(() => setPurse(1618), 700)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <ToastProvider>
      <div className="pp-desk" style={{ minHeight: '100dvh', paddingBottom: 'var(--s-20)' }}>
        <div
          className="pp-content pp-on-desk"
          style={{ position: 'relative', zIndex: 1, paddingTop: 'calc(var(--safe-t) + var(--s-8))' }}
        >
          {/* ── LOGOTYPE ─────────────────────────────────────────────── */}
          <Paper elevation={3} edge="deckle" tone={0} radius="lg" seed="hero" style={{ padding: 'var(--s-8) var(--s-5)', marginBottom: 'var(--s-10)' }}>
            <div style={{ display: 'grid', placeItems: 'center', gap: 'var(--s-6)' }}>
              <Logotype mark markSize={92} />
              <div style={row}>
                <Crane size={78} title="A paper crane" />
                <CraneMark size={64} />
                <CraneMark size={40} />
              </div>
            </div>
          </Paper>

          <Section title="Paper" note="Elevation 0–4 · edges: clean, cut, deckle, torn. Every sheet is a different sheet.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 'var(--s-4)' }}>
              {EDGES.map((edge) =>
                ([1, 3] as const).map((elev) => (
                  <Paper
                    key={`${edge}-${elev}`}
                    edge={edge}
                    elevation={elev}
                    tone={0}
                    seed={`${edge}-${elev}`}
                    radius="md"
                    style={{ padding: 'var(--s-4)', minHeight: 96 }}
                  >
                    <span className="pp-label">{edge}</span>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 800 }}>
                      e{elev}
                    </div>
                  </Paper>
                )),
              )}
            </div>
            <div style={{ ...row, marginTop: 'var(--s-4)' }}>
              {([0, 1, 2, 3, 4] as const).map((tone) => (
                <Paper key={tone} tone={tone} elevation={2} edge="cut" seed={`tone-${tone}`} style={{ padding: 'var(--s-4) var(--s-5)' }}>
                  <span className="pp-label" style={{ color: 'var(--ink)' }}>
                    paper {tone}
                  </span>
                </Paper>
              ))}
              <Paper tone={0} elevation={2} edge="cut" dogEar seed="dogear" style={{ padding: 'var(--s-4) var(--s-5)' }}>
                <span className="pp-label">dog ear</span>
              </Paper>
            </div>
          </Section>

          {/* ── BUTTONS ──────────────────────────────────────────────── */}
          <Section title="Button" note="A folded card on a hard offset shadow. It presses flat.">
            <div style={{ ...row, marginBottom: 'var(--s-4)' }}>
              {ACCENTS.map((a) => (
                <Button key={a} variant={a} icon="fold">
                  {a}
                </Button>
              ))}
            </div>
            <div style={{ ...row, marginBottom: 'var(--s-4)' }}>
              <Button variant="soft" accent="ai" icon="water">
                soft
              </Button>
              <Button variant="ghost" icon="back">
                ghost
              </Button>
              <Button variant="quiet" icon="info">
                quiet
              </Button>
              <Button variant="beni" disabled icon="lock">
                disabled
              </Button>
              <Button variant="matcha" pressed icon="check">
                pressed
              </Button>
            </div>
            <div style={{ ...row, marginBottom: 'var(--s-4)' }}>
              <Button size="sm" variant="ai">
                small
              </Button>
              <Button size="md" variant="ai">
                medium
              </Button>
              <Button size="lg" variant="ai" icon="crane">
                large
              </Button>
              <IconButton icon="sound-on" label="Sound on" variant="ghost" />
              <IconButton icon="settings" label="Settings" variant="quiet" />
              <IconButton icon="close" label="Close" variant="ink" size="sm" />
            </div>
            <Button variant="beni" size="lg" block icon="fold" iconAfter="chevron">
              Begin the fold
            </Button>
          </Section>

          {/* ── ICONS ────────────────────────────────────────────────── */}
          <Section title="Icon" note={`${ICON_NAMES.length} cut-paper silhouettes, scissored from one sheet.`}>
            <Paper tone={0} elevation={2} edge="cut" seed="icons" radius="lg" style={{ padding: 'var(--s-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: 'var(--s-4)' }}>
                {ICON_NAMES.map((name) => (
                  <div key={name} style={{ display: 'grid', placeItems: 'center', gap: 6, textAlign: 'center' }}>
                    <Icon name={name} size={30} title={name} />
                    <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--ink-soft)', fontWeight: 700 }}>{name}</span>
                  </div>
                ))}
              </div>
              <hr className="pp-hairline pp-hairline--fade" style={{ margin: 'var(--s-5) 0' }} />
              <div style={row}>
                {ACCENTS.map((a) => (
                  <Icon key={a} name="crane" size={30} accent={a} title={`crane in ${a}`} />
                ))}
              </div>
            </Paper>
          </Section>

          {/* ── CURRENCY ─────────────────────────────────────────────── */}
          <Section title="Currency" note="Tabular numerals, so a ticking purse never jitters.">
            <div style={row}>
              <Currency kind="sheets" value={purse} />
              <Currency kind="goldleaf" value={24} delta={3} />
              <Currency kind="sheets" value={9} animate={false} />
              <Currency kind="goldleaf" value={1250} />
            </div>
          </Section>

          {/* ── CHIPS ────────────────────────────────────────────────── */}
          <Section title="Chip">
            <div style={{ ...row, marginBottom: 'var(--s-3)' }}>
              <Chip>Meadow</Chip>
              <Chip icon="star" accent="kincha" tone="wash">
                Adept
              </Chip>
              <Chip accent="murasaki" tone="solid" icon="sparkle">
                Mythic
              </Chip>
              <Chip accent="matcha" dot>
                Forest
              </Chip>
              <Chip accent="ai" dot tone="wash">
                Shore
              </Chip>
            </div>
            <div style={row}>
              <Chip accent="beni" selected onClick={() => {}}>
                All folds
              </Chip>
              <Chip accent="beni" selected={false} onClick={() => {}}>
                Unfolded
              </Chip>
              <Chip accent="beni" selected={false} onClick={() => {}}>
                Mastered
              </Chip>
            </div>
          </Section>

          {/* ── TABS ─────────────────────────────────────────────────── */}
          <Section title="Tabs" note="Index cards. The active card is pulled forward out of the box.">
            <Tabs
              label="Gallery sections"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'studio', label: 'Studio', icon: 'fold', accent: 'beni' },
                { id: 'codex', label: 'Codex', icon: 'codex', accent: 'ai' },
                { id: 'shop', label: 'Shop', icon: 'shop', accent: 'kincha' },
                { id: 'locked', label: 'Atelier', icon: 'lock', accent: 'murasaki', disabled: true },
              ]}
            >
              <h3 style={{ marginBottom: 8 }}>{tab === 'studio' ? 'The Studio' : tab === 'codex' ? 'The Codex' : 'The Shop'}</h3>
              <p style={{ color: 'var(--ink-soft)' }}>
                Rub the crease until it holds. The paper will tell you when it has taken.
              </p>
            </Tabs>
          </Section>

          {/* ── METERS ───────────────────────────────────────────────── */}
          <Section title="Meter" note="Ink soaking into a paper strip. The leading edge is still wet.">
            <div className="pp-stack">
              <Meter label="Mastery" caption="Adept" value={0.62} accent="kincha" />
              <Meter label="Fold journal" caption="tier 4 of 12" value={4} max={12} accent="murasaki" ticks size="lg" />
              <Meter label="Bond" caption="88" value={88} max={100} accent="sakura" size="sm" />
              <Meter label="Steps" caption="3 of 7" value={3} max={7} accent="matcha" />
            </div>
          </Section>

          {/* ── CONTROLS ─────────────────────────────────────────────── */}
          <Section title="Toggle & Slider">
            <Paper tone={0} elevation={2} edge="cut" seed="controls" radius="lg" style={{ padding: 'var(--s-5)' }}>
              <div className="pp-stack">
                <Toggle checked={sound} onChange={setSound} label="Paper sounds" hint="Close-mic'd, and worth headphones." labelFirst />
                <hr className="pp-hairline" />
                <Toggle checked={assist} onChange={setAssist} label="Guided folding" hint="Tap to fold instead of dragging." accent="ai" labelFirst />
                <hr className="pp-hairline" />
                <Toggle checked={false} onChange={() => {}} label="Disabled switch" disabled labelFirst />
                <hr className="pp-hairline" />
                <Slider label="Ambience" value={volume} onChange={setVolume} accent="ai" />
                <Slider
                  label="Guides"
                  value={guides}
                  onChange={setGuides}
                  min={0}
                  max={7}
                  step={1}
                  ticks={7}
                  accent="matcha"
                  format={(v) => `${v} of 7`}
                />
              </div>
            </Paper>
          </Section>

          {/* ── OVERLAYS ─────────────────────────────────────────────── */}
          <Section title="Sheet & Toast">
            <div style={{ ...row, marginBottom: 'var(--s-3)' }}>
              <Button variant="ai" icon="sheets" onClick={() => setSheetOpen(true)}>
                Open bottom sheet
              </Button>
              <Button variant="ghost" icon="info" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
            </div>
            <ToastDemo />
          </Section>

          {/* ── REVEAL ───────────────────────────────────────────────── */}
          <Section title="Reveal & Stagger" note="Sheets dealt onto the desk, one after another.">
            <Stagger step={70} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--s-3)' }}>
              {['Crane', 'Heron', 'Frog', 'Fox', 'Koi', 'Moth'].map((n) => (
                <Paper key={n} tone={0} elevation={2} edge="cut" seed={n} style={{ padding: 'var(--s-4)', textAlign: 'center' }}>
                  <Icon name="crane" size={26} accent="beni" />
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginTop: 4 }}>{n}</div>
                </Paper>
              ))}
            </Stagger>
            <Reveal delay={120} style={{ marginTop: 'var(--s-4)' }}>
              <Paper tone={2} elevation={1} edge="torn" seed="torn-note" style={{ padding: 'var(--s-5)' }}>
                <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
                  A torn edge, for the notes you keep.
                </p>
              </Paper>
            </Reveal>
          </Section>
        </div>

        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Choose your washi"
          note="Every sheet folds the same. They just don't look the same."
          footer={
            <>
              <Button variant="ghost" block onClick={() => setSheetOpen(false)}>
                Not now
              </Button>
              <Button variant="beni" block icon="check" onClick={() => setSheetOpen(false)}>
                Use this one
              </Button>
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 'var(--s-3)' }}>
            {['Kozo', 'Chiyogami', 'Momi', 'Unryu', 'Gampi', 'Kinpaku'].map((w, i) => (
              <Paper key={w} tone={i === 1 ? 1 : 2} elevation={1} edge="deckle" seed={w} style={{ padding: 'var(--s-4)', minHeight: 82 }}>
                <span className="pp-label">{w}</span>
              </Paper>
            ))}
          </div>
        </Sheet>

        <Sheet
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          side="center"
          edge="cut"
          title="Welcome back"
          note="Your streak rested. It is still yours."
          footer={
            <Button variant="matcha" block icon="check" onClick={() => setModalOpen(false)}>
              Fold today
            </Button>
          }
        >
          <p style={{ color: 'var(--ink-soft)' }}>Nothing was lost while you were away. The Kami kept the lamp on.</p>
        </Sheet>
      </div>
    </ToastProvider>
  )
}
