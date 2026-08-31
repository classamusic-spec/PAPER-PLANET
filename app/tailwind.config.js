/**
 * PAPER PLANET — Tailwind wired to the frozen design tokens.
 *
 * Every value below resolves to a CSS custom property from `src/styles/tokens.css`,
 * so a utility class and a hand-written rule always agree, and the night theme
 * re-tints both for free.
 *
 * NOTE ON OPACITY MODIFIERS: token colours are hex, not channel triplets, so
 * `bg-beni/50` cannot be synthesised. Use `color-mix()` in CSS, or the
 * `*-wash` tokens, when you need a tint.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  // The app switches themes with <html data-theme="night">, not a class.
  darkMode: ['selector', '[data-theme="night"]'],
  content: ['./index.html', './gallery.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── the paper stack ─────────────────────────────────────────── */
        paper: {
          0: 'var(--paper-0)',
          1: 'var(--paper-1)',
          2: 'var(--paper-2)',
          3: 'var(--paper-3)',
          4: 'var(--paper-4)',
          edge: 'var(--paper-edge)',
          back: 'var(--paper-back)',
          DEFAULT: 'var(--paper-1)',
        },
        /* ── ink ─────────────────────────────────────────────────────── */
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
          faint: 'var(--ink-faint)',
          hair: 'var(--ink-hair)',
          'on-dark': 'var(--ink-on-dark)',
          'on-light': 'var(--ink-on-light)',
        },
        /* ── natural-dye accents ─────────────────────────────────────── */
        beni: { DEFAULT: 'var(--beni)', deep: 'var(--beni-deep)', soft: 'var(--beni-soft)' },
        kincha: { DEFAULT: 'var(--kincha)', deep: 'var(--kincha-deep)', soft: 'var(--kincha-soft)' },
        matcha: { DEFAULT: 'var(--matcha)', deep: 'var(--matcha-deep)', soft: 'var(--matcha-soft)' },
        ai: { DEFAULT: 'var(--ai)', deep: 'var(--ai-deep)', soft: 'var(--ai-soft)' },
        murasaki: { DEFAULT: 'var(--murasaki)', deep: 'var(--murasaki-deep)', soft: 'var(--murasaki-soft)' },
        sakura: { DEFAULT: 'var(--sakura)', deep: 'var(--sakura-deep)' },
        gold: { DEFAULT: 'var(--gold-leaf)', hi: 'var(--gold-hi)' },

        /* ── semantic aliases (these also keep the leftover shadcn
              primitives in src/components/ui rendering as paper) ─────── */
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-sunken': 'var(--surface-sunken)',
        desk: 'var(--desk)',
        accent: { DEFAULT: 'var(--kincha)', foreground: 'var(--ink)' },
        positive: 'var(--positive)',
        info: 'var(--info)',
        rare: 'var(--rare)',
        background: 'var(--paper-1)',
        foreground: 'var(--ink)',
        border: 'var(--paper-edge)',
        input: 'var(--paper-edge)',
        ring: 'var(--ink)',
        primary: { DEFAULT: 'var(--beni-deep)', foreground: 'var(--ink-on-dark)' },
        secondary: { DEFAULT: 'var(--paper-2)', foreground: 'var(--ink)' },
        muted: { DEFAULT: 'var(--paper-2)', foreground: 'var(--ink-soft)' },
        destructive: { DEFAULT: 'var(--beni-deep)', foreground: 'var(--ink-on-dark)' },
        card: { DEFAULT: 'var(--paper-0)', foreground: 'var(--ink)' },
        popover: { DEFAULT: 'var(--paper-0)', foreground: 'var(--ink)' },
        sidebar: {
          DEFAULT: 'var(--paper-2)',
          foreground: 'var(--ink)',
          primary: 'var(--beni-deep)',
          'primary-foreground': 'var(--ink-on-dark)',
          accent: 'var(--kincha)',
          'accent-foreground': 'var(--ink)',
          border: 'var(--paper-edge)',
          ring: 'var(--ink)',
        },
      },

      fontFamily: {
        display: 'var(--font-display)',
        text: 'var(--font-text)',
        sans: 'var(--font-text)',
        serif: 'var(--font-display)',
      },

      fontSize: {
        'display-xl': ['var(--fs-display-xl)', { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-display)' }],
        'display-l': ['var(--fs-display-l)', { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-display)' }],
        'display-m': ['var(--fs-display-m)', { lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--tracking-display)' }],
        title: ['var(--fs-title)', { lineHeight: 'var(--lh-snug)' }],
        'body-l': ['var(--fs-body-l)', { lineHeight: 'var(--lh-body)' }],
        body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)' }],
        label: ['var(--fs-label)', { lineHeight: 'var(--lh-snug)', letterSpacing: 'var(--tracking-label)' }],
        micro: ['var(--fs-micro)', { lineHeight: 'var(--lh-snug)', letterSpacing: 'var(--tracking-label)' }],
      },
      lineHeight: { tight: 'var(--lh-tight)', snug: 'var(--lh-snug)', body: 'var(--lh-body)' },
      letterSpacing: { label: 'var(--tracking-label)', display: 'var(--tracking-display)' },

      boxShadow: {
        none: 'none',
        e1: 'var(--sh-1)',
        e2: 'var(--sh-2)',
        e3: 'var(--sh-3)',
        e4: 'var(--sh-4)',
        card: 'var(--sh-card)',
        press: 'var(--sh-press)',
        edge: 'inset 0 0 0 1px var(--paper-edge)',
      },

      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },

      spacing: {
        1: 'var(--s-1)',
        2: 'var(--s-2)',
        3: 'var(--s-3)',
        4: 'var(--s-4)',
        5: 'var(--s-5)',
        6: 'var(--s-6)',
        8: 'var(--s-8)',
        10: 'var(--s-10)',
        12: 'var(--s-12)',
        16: 'var(--s-16)',
        20: 'var(--s-20)',
        touch: 'var(--touch-min)',
        hud: 'var(--hud-h)',
        'safe-t': 'var(--safe-t)',
        'safe-b': 'var(--safe-b)',
        'safe-l': 'var(--safe-l)',
        'safe-r': 'var(--safe-r)',
      },
      minHeight: { touch: 'var(--touch-min)', hud: 'var(--hud-h)' },
      minWidth: { touch: 'var(--touch-min)' },
      maxWidth: { content: 'var(--content-max)' },

      zIndex: {
        scene: 'var(--z-scene)',
        content: 'var(--z-content)',
        hud: 'var(--z-hud)',
        sheet: 'var(--z-sheet)',
        toast: 'var(--z-toast)',
        overlay: 'var(--z-overlay)',
      },

      transitionTimingFunction: {
        paper: 'var(--ease-paper)',
        settle: 'var(--ease-settle)',
        crisp: 'var(--ease-crisp)',
        alive: 'var(--ease-alive)',
        DEFAULT: 'var(--ease-paper)',
      },
      transitionDuration: {
        tap: 'var(--t-tap)',
        quick: 'var(--t-quick)',
        base: 'var(--t-base)',
        slow: 'var(--t-slow)',
        page: 'var(--t-page)',
        DEFAULT: 'var(--t-quick)',
      },

      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        breathe: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.018)' } },
        rise: {
          from: { opacity: '0', transform: 'translate3d(0,16px,0) rotate(-1.4deg)' },
          to: { opacity: '1', transform: 'translate3d(0,0,0) rotate(0deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down var(--t-base) var(--ease-paper)',
        'accordion-up': 'accordion-up var(--t-base) var(--ease-paper)',
        breathe: 'breathe 4.2s ease-in-out infinite',
        rise: 'rise var(--t-slow) var(--ease-settle) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
