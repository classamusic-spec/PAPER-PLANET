/* PAPER PLANET — The Shop. A stationer's display case, never a paywall. */

import { useCallback, useMemo, useState } from 'react'
import type { Sku, SkuKind } from '../../contracts'
import { allWashi, getSpecies, washiByPack } from '../../content'
import type { JournalProgress, JournalReward } from '../../systems'
import {
  actions,
  SEASON_ONE,
  useAtelier,
  useEntitlements,
  useJournal,
  usePurchasePending,
  useSkus,
  useStorefrontOpen,
  useGame,
  useWallet,
} from '../../systems'
import { audio, haptics } from '../../audio'
import { useNavigation, useRouteParams } from '../../shell/Navigator'
import { Button, Chip, GoldLeafPill, Icon, IconButton, Meter, Paper, SheetsPill, Tabs, useToast } from '../../ui'
import WashiSwatch from '../codex/WashiSwatch'
import './shop.css'

const SECTIONS: { id: SkuKind | 'journal'; label: string }[] = [
  { id: 'subscription', label: 'The Atelier' },
  { id: 'washi-pack', label: 'Washi' },
  { id: 'goldleaf', label: 'Gold Leaf' },
  { id: 'journal', label: 'Fold Journal' },
]

export default function ShopScreen() {
  const nav = useNavigation()
  const open = useStorefrontOpen()
  const skus = useSkus()
  const wallet = useWallet()
  const atelier = useAtelier()
  const entitlements = useEntitlements()
  const journal = useJournal()
  const premium = useGame((g) => g.journal.premium)
  const pendingSku = usePurchasePending()
  const pending = pendingSku !== null
  const toast = useToast()
  /* Openable at a section. Without this the Shop always landed on The Atelier,
     so any link about the Fold Journal — a thing the player has already earned
     — would have dropped them on a subscription pitch instead. */
  const { tab: wantTab } = useRouteParams<{ tab: string }>()
  const [tab, setTab] = useState<string>(() =>
    wantTab && SECTIONS.some((s) => s.id === wantTab) ? wantTab : 'subscription',
  )

  const packs = useMemo(() => washiByPack(), [])

  const buy = useCallback(
    async (sku: Sku) => {
      audio.play('ui.confirm')
      const res = await actions.purchase(sku.id)
      if (res.ok) {
        audio.play('reward.unlock')
        haptics.fire('reward')
        toast.show({ title: 'Thank you.', note: `${sku.name} is yours.` })
      } else if (res.reason === 'cancelled') {
        // Cancelling is a normal thing a person does. Say nothing.
      } else {
        toast.show({ title: 'That did not go through.', note: res.message ?? 'Nothing was charged.' })
      }
    },
    [toast],
  )

  const restore = useCallback(async () => {
    const ids = await actions.restorePurchases()
    toast.show({
      title: ids.length ? 'Restored.' : 'Nothing to restore.',
      note: ids.length ? `${ids.length} ${ids.length === 1 ? 'purchase' : 'purchases'} found.` : undefined,
    })
  }, [toast])

  /* Per BRAND section 12, nothing is for sale until the player has folded
     their first Kami. Before that, this is not a sales page. */
  if (!open) {
    return (
      <div className="pp-shop pp-shop--closed">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <div className="pp-shop__closed">
          <Icon name="crane" size={72} />
          <h1>Fold something first.</h1>
          <p>
            The shop opens once you have a Kami of your own. There is nothing here
            you need before then.
          </p>
          <Button variant="beni" onClick={() => nav.replace('select')}>
            Choose a fold
          </Button>
        </div>
      </div>
    )
  }

  const inSection = (kind: string) =>
    skus.filter((s) => (tab === 'journal' ? s.kind === 'journal' : s.kind === kind))

  return (
    <div className="pp-shop">
      <header className="pp-shop__head">
        <IconButton icon="back" label="Back" variant="quiet" onClick={() => nav.back()} />
        <h1>The Shop</h1>
        <div className="pp-shop__purse">
          <SheetsPill value={wallet.sheets} />
          <GoldLeafPill value={wallet.goldLeaf} />
        </div>
      </header>

      <div className="pp-shop__tabs">
        <Tabs
          label="Shop sections"
          bare
          items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
          value={tab}
          onChange={(id) => {
            setTab(id)
            audio.play('ui.tap')
          }}
        />
      </div>

      <div className="pp-shop__scroll">
        {tab === 'journal' ? (
          <FoldJournal journal={journal} skus={skus} onBuy={buy} pending={pending} premium={premium} />
        ) : (
          <ul className="pp-shop__list">
            {inSection(tab).map((sku) => {
              const owned = sku.grants.entitlements?.every((e) => entitlements.includes(e)) ?? false
              const isSub = sku.kind === 'subscription'
              return (
                <li key={sku.id}>
                  <Paper elevation={2} edge="deckle" tone={0} grain className="pp-shop__card">
                    <div className="pp-shop__card-head">
                      <div>
                        <p className="pp-shop__kind" data-accent={sku.accent}>
                          {sku.kind === 'washi-pack' ? 'Washi pack' : sku.kind === 'goldleaf' ? 'Gold Leaf' : 'Membership'}
                        </p>
                        <h2>{sku.name}</h2>
                        <p className="pp-shop__tagline">{sku.tagline}</p>
                      </div>
                      <p className="pp-shop__price">{sku.price}</p>
                    </div>

                    {sku.kind === 'washi-pack' && (
                      <div className="pp-shop__swatches">
                        {(packs[sku.id] ?? allWashi().filter((w) => w.source.type === 'pack' && w.source.sku === sku.id))
                          .slice(0, 4)
                          .map((w) => (
                            <WashiSwatch key={w.id} washi={w} size={54} decorative />
                          ))}
                      </div>
                    )}

                    <ul className="pp-shop__benefits">
                      {sku.benefits.map((b) => (
                        <li key={b}>
                          <Icon name="check" size={13} /> {b}
                        </li>
                      ))}
                    </ul>

                    <div className="pp-shop__act">
                      {owned || (isSub && atelier) ? (
                        <Chip selected>
                          <Icon name="check" size={12} /> Yours
                        </Chip>
                      ) : (
                        <Button
                          variant={sku.accent === 'kincha' ? 'kincha' : 'beni'}
                          onClick={() => void buy(sku)}
                          disabled={pending}
                        >
                          {sku.price}
                          {sku.period ? ` / ${sku.period}` : ''}
                        </Button>
                      )}
                    </div>
                  </Paper>
                </li>
              )
            })}
          </ul>
        )}

        <div className="pp-shop__foot">
          <Button variant="quiet" size="sm" onClick={() => void restore()}>
            Restore purchases
          </Button>
          <p className="pp-shop__promise">
            Everything here is paper and patience. Nothing sold makes a fold easier,
            and nothing expires.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── The Fold Journal ─────────────────────────────────────────────────────── */

/** One reward slot, printed. */
function rewardLabel(r: JournalReward): string {
  switch (r.kind) {
    case 'sheets':
      return `${r.amount} Sheets`
    case 'goldleaf':
      return `${r.amount} Gold Leaf`
    case 'washi':
      return r.note
    case 'species':
      return getSpecies(r.speciesId)?.name ?? 'A fold'
    case 'entitlement':
      return r.note
    case 'title':
      return r.label
  }
}

function FoldJournal({
  journal,
  skus,
  onBuy,
  pending,
  premium,
}: {
  journal: JournalProgress
  skus: readonly Sku[]
  onBuy: (sku: Sku) => void | Promise<void>
  pending: boolean
  premium: boolean
}) {
  const premiumSku = skus.find((s) => s.kind === 'journal')
  const tiers = SEASON_ONE.tiers
  const unclaimed = journal.earnedTier - journal.claimedTier

  return (
    <div className="pp-journal">
      <Paper elevation={2} edge="cut" tone={0} grain>
        <div className="pp-journal__head">
          <h2>{SEASON_ONE.name}</h2>
          <p>{SEASON_ONE.note}</p>
          <Meter
            value={journal.ratio}
            label={journal.maxed ? 'Complete' : `Tier ${journal.earnedTier + 1}`}
            caption={journal.maxed ? '—' : `${journal.xpIntoTier} / ${journal.xpForNextTier}`}
            accent="kincha"
          />
        </div>
      </Paper>

      {journal.hasUnclaimed && (
        <div className="pp-journal__claim">
          <Button
            variant="matcha"
            onClick={() => {
              actions.claimJournal()
              audio.play('reward.sheets')
              haptics.fire('reward')
            }}
          >
            Collect {unclaimed} {unclaimed === 1 ? 'tier' : 'tiers'}
          </Button>
        </div>
      )}

      <ol className="pp-journal__track" aria-label="Journal tiers">
        <li className="pp-journal__legend" aria-hidden="true">
          <span />
          <span>Free</span>
          <span>Atelier</span>
        </li>
        {tiers.map((t) => {
          const reached = t.tier <= journal.earnedTier
          const taken = t.tier <= journal.claimedTier
          return (
            <li
              key={t.tier}
              className={
                'pp-journal__tier' + (reached ? ' is-reached' : '') + (taken ? ' is-taken' : '')
              }
            >
              <span className="pp-journal__n">{t.tier}</span>
              <span className="pp-journal__free">
                {t.free.map(rewardLabel).join(' · ') || '—'}
              </span>
              <span className={'pp-journal__prem' + (premium ? '' : ' is-locked')}>
                {t.premium.map(rewardLabel).join(' · ') || '—'}
              </span>
            </li>
          )
        })}
      </ol>

      {premiumSku && !premium && (
        <Paper elevation={1} edge="deckle" tone={1} grain className="pp-journal__upsell">
          <div className="pp-journal__upsell-body">
            <h3>{premiumSku.name}</h3>
            <p>{premiumSku.tagline}</p>
            <p className="pp-journal__upsell-note">
              The free column stays free, and everything you have already earned stays yours.
            </p>
            <Button variant="kincha" onClick={() => void onBuy(premiumSku)} disabled={pending}>
              {premiumSku.price}
            </Button>
          </div>
        </Paper>
      )}
    </div>
  )
}
