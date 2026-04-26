import type { Config } from "tailwindcss";

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
 *   • hsl(var(--token)) — for web (reads CSS custom properties from globals.css)
 *   • raw hex fallback  — for NativeWind / React Native (no CSS variables at runtime)
 *
 * Swap via the `platform` helper at the bottom of this file if needed.
 */

const config: Config = {
  darkMode: ["class"],

  content: [
    "./app/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],

  theme: {
    // ── CONTAINER ─────────────────────────────────────────────
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },

    extend: {
      // ── COLORS ──────────────────────────────────────────────
      colors: {
        /* Semantic tokens — map to CSS vars in globals.css */
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",

        surface:      "hsl(var(--surface))",
        "surface-2":  "hsl(var(--surface-2))",

        border:       "hsl(var(--border))",
        "border-hover": "hsl(var(--border-hover))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",

        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        subtle: {
          foreground: "hsl(var(--subtle-foreground))",
        },

        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        /* Brand palette */
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dim:        "rgba(31,216,124,0.12)",
          /* NativeWind / RN hex fallback */
          hex:        "#1fd87c",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          dim:        "rgba(79,142,247,0.12)",
          hex:        "#4f8ef7",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          dim:        "rgba(255,92,106,0.12)",
          hex:        "#ff5c6a",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          dim:        "rgba(245,166,35,0.12)",
          hex:        "#f5a623",
        },

        /* Raw scale — use sparingly; prefer semantic tokens above */
        brand: {
          green:  "#1fd87c",
          blue:   "#4f8ef7",
          coral:  "#ff5c6a",
          amber:  "#f5a623",
          violet: "#a78bfa",
          orange: "#f97316",
          rose:   "#fb7185",
        },

        /* Chart palette (recharts / Chart.js class names) */
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },

      // ── TYPOGRAPHY ──────────────────────────────────────────
      fontFamily: {
        sans:   ["Heebo", "Segoe UI", "system-ui", "sans-serif"],
        hebrew: ["Heebo", "David Libre", "serif"],
        mono:   ["'JetBrains Mono'", "Menlo", "monospace"],
      },

      fontSize: {
        /* Display — hero KPI numbers */
        "display-lg": ["2.25rem",  { lineHeight: "1",    fontWeight: "800" }], /* 36px */
        "display-md": ["1.75rem",  { lineHeight: "1",    fontWeight: "800" }], /* 28px */
        "display-sm": ["1.375rem", { lineHeight: "1.1",  fontWeight: "700" }], /* 22px */
        /* Body */
        "body-lg":    ["1rem",     { lineHeight: "1.6",  fontWeight: "400" }], /* 16px */
        "body-md":    ["0.9375rem",{ lineHeight: "1.6",  fontWeight: "400" }], /* 15px */
        "body-sm":    ["0.875rem", { lineHeight: "1.5",  fontWeight: "400" }], /* 14px */
        "body-xs":    ["0.8125rem",{ lineHeight: "1.5",  fontWeight: "500" }], /* 13px */
        /* Label / caption */
        "label-md":   ["0.75rem",  { lineHeight: "1.4",  fontWeight: "500" }], /* 12px */
        "label-sm":   ["0.6875rem",{ lineHeight: "1.4",  fontWeight: "600" }], /* 11px */
        "label-xs":   ["0.625rem", { lineHeight: "1.3",  fontWeight: "600", letterSpacing: "0.06em" }], /* 10px */
      },

      fontWeight: {
        light:    "300",
        regular:  "400",
        medium:   "500",
        semibold: "600",
        bold:     "700",
        extrabold:"800",
      },

      // ── SPACING ─────────────────────────────────────────────
      /*
       * Base unit: 4px (0.25rem).
       * Extends Tailwind's default scale with named semantic steps.
       */
      spacing: {
        /* Component micro-spacing */
        "0.5":  "0.125rem",  /*  2px */
        "1":    "0.25rem",   /*  4px */
        "1.5":  "0.375rem",  /*  6px */
        "2":    "0.5rem",    /*  8px */
        "2.5":  "0.625rem",  /* 10px */
        "3":    "0.75rem",   /* 12px */
        "3.5":  "0.875rem",  /* 14px */
        "4":    "1rem",      /* 16px */
        "5":    "1.25rem",   /* 20px */
        "6":    "1.5rem",    /* 24px */
        "7":    "1.75rem",   /* 28px */
        "8":    "2rem",      /* 32px */
        /* Layout section spacing */
        "10":   "2.5rem",    /* 40px */
        "12":   "3rem",      /* 48px */
        "16":   "4rem",      /* 64px */
        "20":   "5rem",      /* 80px */
        "24":   "6rem",      /* 96px */
        /* Sidebar */
        "sidebar":     "12.5rem",  /* 200px */
        "sidebar-sm":  "4.5rem",   /*  72px — collapsed */
        /* Bottom nav (mobile) */
        "bottom-nav":  "5rem",     /*  80px */
      },

      // ── BORDER RADIUS ───────────────────────────────────────
      borderRadius: {
        none:   "0",
        xs:     "var(--radius-xs)",   /*  6px — pills, tight */
        sm:     "var(--radius-sm)",   /* 10px — badges, small cards */
        DEFAULT:"var(--radius-sm)",
        md:     "0.75rem",            /* 12px */
        lg:     "var(--radius)",      /* 16px — cards, modals */
        xl:     "1.25rem",            /* 20px */
        "2xl":  "1.5rem",             /* 24px */
        full:   "9999px",
      },

      // ── BOX SHADOW ──────────────────────────────────────────
      boxShadow: {
        /* Glow shadows — match brand accents */
        "glow-green":  "0 4px 24px rgba(31,216,124,0.25)",
        "glow-blue":   "0 4px 24px rgba(79,142,247,0.20)",
        "glow-coral":  "0 4px 24px rgba(255,92,106,0.20)",
        /* Card elevations */
        "card-sm":     "0 1px 4px rgba(0,0,0,0.35)",
        "card-md":     "0 4px 16px rgba(0,0,0,0.4)",
        "card-lg":     "0 8px 32px rgba(0,0,0,0.5)",
      },

      // ── KEYFRAMES / ANIMATION ───────────────────────────────
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up":  "fade-up 0.5s ease both",
        "fade-in":  "fade-in 0.3s ease both",
        "scale-in": "scale-in 0.3s ease both",
      },

      // ── TRANSITIONS ─────────────────────────────────────────
      transitionDuration: {
        fast:   "150ms",
        normal: "200ms",
        slow:   "350ms",
      },
    },
  },

  plugins: [
    require("tailwindcss-animate"),   /* shadcn/ui animations  */
    require("@tailwindcss/typography"),
  ],
};

export default config;
