import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/**
 * Famileconomy — Tailwind + NativeWind design token config
 *
 * Works as:
 *  1. A standard tailwind.config.ts for a Next.js / Vite web app.
 *  2. A NativeWind preset — import and spread into your nativewind config:
 *       import famileconomy from './tailwind.config'
 *       export default { presets: [famileconomy], ... }
 *
 * All color values are defined twice:
 *   • var(--token)      — for web (reads OKLCH CSS custom properties from globals.css)
 *   • raw hex fallback  — for NativeWind / React Native (no CSS variables at runtime)
 */

const config: Config = {
  darkMode: ['class'],

  content: [
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],

  theme: {
    // ── CONTAINER ─────────────────────────────────────────────
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },

    extend: {
      // ── COLORS ──────────────────────────────────────────────
      // All CSS var tokens are OKLCH in globals.css. The hsl() wrapper is
      // removed — var() is used directly so the browser parses OKLCH values.
      // NativeWind hex fallbacks are updated to match the new OKLCH palette.
      colors: {
        /* Semantic tokens — map to CSS vars in globals.css */
        background: 'var(--background)',
        foreground: 'var(--foreground)',

        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',

        border: 'var(--border)',
        'border-hover': 'var(--border-hover)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        subtle: {
          foreground: 'var(--subtle-foreground)',
        },

        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },

        /* Brand palette */
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          dim: 'oklch(62% 0.14 170 / 0.12)',
          /* NativeWind / RN hex fallback — calm teal-green */
          hex: '#2dba8a',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          dim: 'oklch(65% 0.16 240 / 0.12)',
          hex: '#5b8ef5',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
          dim: 'oklch(62% 0.22 25 / 0.12)',
          hex: '#e8544a',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
          dim: 'oklch(72% 0.18 65 / 0.12)',
          hex: '#d48e1e',
        },

        /* Raw scale — use sparingly; prefer semantic tokens above */
        brand: {
          teal: '#2dba8a',
          blue: '#5b8ef5',
          coral: '#e8544a',
          amber: '#d4a520',
          violet: '#9b7fe8',
          orange: '#e07530',
          rose: '#e05575',
        },

        /* Chart palette (recharts / Chart.js class names) */
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
      },

      // ── TYPOGRAPHY ──────────────────────────────────────────
      fontFamily: {
        sans: ['Heebo', 'Segoe UI', 'system-ui', 'sans-serif'],
        hebrew: ['Heebo', 'David Libre', 'serif'],
        mono: ["'JetBrains Mono'", 'Menlo', 'monospace'],
      },

      fontSize: {
        /* Display — hero KPI numbers */
        'display-lg': ['2.25rem', { lineHeight: '1', fontWeight: '800' }] /* 36px */,
        'display-md': ['1.75rem', { lineHeight: '1', fontWeight: '800' }] /* 28px */,
        'display-sm': ['1.375rem', { lineHeight: '1.1', fontWeight: '700' }] /* 22px */,
        /* Body */
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }] /* 16px */,
        'body-md': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }] /* 15px */,
        'body-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }] /* 14px */,
        'body-xs': ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }] /* 13px */,
        /* Label / caption */
        'label-md': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }] /* 12px */,
        'label-sm': ['0.6875rem', { lineHeight: '1.4', fontWeight: '600' }] /* 11px */,
        'label-xs': [
          '0.625rem',
          { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.06em' },
        ] /* 10px */,
      },

      fontWeight: {
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },

      // ── SPACING ─────────────────────────────────────────────
      /*
       * Base unit: 4px (0.25rem).
       * Extends Tailwind's default scale with named semantic steps.
       */
      spacing: {
        /* Component micro-spacing */
        '0.5': '0.125rem' /*  2px */,
        '1': '0.25rem' /*  4px */,
        '1.5': '0.375rem' /*  6px */,
        '2': '0.5rem' /*  8px */,
        '2.5': '0.625rem' /* 10px */,
        '3': '0.75rem' /* 12px */,
        '3.5': '0.875rem' /* 14px */,
        '4': '1rem' /* 16px */,
        '5': '1.25rem' /* 20px */,
        '6': '1.5rem' /* 24px */,
        '7': '1.75rem' /* 28px */,
        '8': '2rem' /* 32px */,
        /* Layout section spacing */
        '10': '2.5rem' /* 40px */,
        '12': '3rem' /* 48px */,
        '16': '4rem' /* 64px */,
        '20': '5rem' /* 80px */,
        '24': '6rem' /* 96px */,
        /* Sidebar */
        sidebar: '12.5rem' /* 200px */,
        'sidebar-sm': '4.5rem' /*  72px — collapsed */,
        /* Bottom nav (mobile) */
        'bottom-nav': '5rem' /*  80px */,
      },

      // ── BORDER RADIUS ───────────────────────────────────────
      borderRadius: {
        none: '0',
        xs: 'var(--radius-xs)' /*  6px — pills, tight */,
        sm: 'var(--radius-sm)' /* 10px — badges, small cards */,
        DEFAULT: 'var(--radius-sm)',
        md: '0.75rem' /* 12px */,
        lg: 'var(--radius)' /* 16px — cards, modals */,
        xl: '1.25rem' /* 20px */,
        '2xl': '1.5rem' /* 24px */,
        full: '9999px',
      },

      // ── BOX SHADOW ──────────────────────────────────────────
      boxShadow: {
        /* Glow shadows — match updated brand accents */
        'glow-teal': '0 4px 24px oklch(62% 0.14 170 / 0.28)',
        'glow-blue': '0 4px 24px oklch(65% 0.16 240 / 0.22)',
        'glow-coral': '0 4px 24px oklch(62% 0.22 25 / 0.22)',
        /* Card elevations — tinted toward brand hue */
        'card-sm': '0 1px 4px oklch(4% 0.01 170 / 0.5)',
        'card-md': '0 4px 16px oklch(4% 0.01 170 / 0.55)',
        'card-lg': '0 8px 32px oklch(4% 0.01 170 / 0.65)',
      },

      // ── KEYFRAMES / ANIMATION ───────────────────────────────
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease both',
        'fade-in': 'fade-in 0.3s ease both',
        'scale-in': 'scale-in 0.3s ease both',
      },

      // ── TRANSITIONS ─────────────────────────────────────────
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '350ms',
      },
    },
  },

  plugins: [animate, typography],
}

export default config
