import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        border: 'hsl(var(--border))',
        'border-hover': 'hsl(var(--border-hover))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        subtle: {
          foreground: 'hsl(var(--subtle-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['2.25rem', { lineHeight: '1', fontWeight: '800' }],
        'display-md': ['1.75rem', { lineHeight: '1', fontWeight: '800' }],
        'display-sm': ['1.375rem', { lineHeight: '1.1', fontWeight: '700' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', fontWeight: '600' }],
        'label-md': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        none: '0',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-sm)',
        md: '0.75rem',
        lg: 'var(--radius)',
        xl: '1.25rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        'glow-green': '0 4px 24px rgba(31,216,124,0.25)',
        'glow-blue': '0 4px 24px rgba(79,142,247,0.20)',
        'glow-coral': '0 4px 24px rgba(255,92,106,0.20)',
        'card-sm': '0 1px 4px rgba(0,0,0,0.35)',
        'card-md': '0 4px 16px rgba(0,0,0,0.4)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease both',
        'fade-in': 'fade-in 0.3s ease both',
      },
    },
  },
  plugins: [animate],
}

export default config
