import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",

  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        void: {
          // V2 Deep space
          0: "#050510",
          1: "#0a0e1f",
          2: "#111633",
          panel: "#0a0e1f",
          // V2 Text
          text: "#e2e8f0",
          "text-soft": "#94a3b8",
          "text-muted": "#8899b0",
          // V2 Borders
          line: "rgba(0,212,255,0.12)",
          "line-strong": "rgba(0,212,255,0.25)",
        },
        cyan: {
          DEFAULT: "#00d4ff",
          dim: "#00a5cc",
          bright: "#66e5ff",
        },
        purple: {
          DEFAULT: "#a855f7",
          dim: "#7c3aed",
        },
        teal: {
          DEFAULT: "#2dd4bf",
        },
        amber: {
          DEFAULT: "#fbbf24",
          dim: "#d97706",
          bright: "#fde68a",
        },
        neon: {
          green: "#00ff88",
          red: "#ff3366",
          pink: "#f472b6",
        },
        success: "#00ff88",
        warning: "#fbbf24",
        danger: "#ff3366",
      },

      backgroundColor: {
        background: "var(--bg-0)",
        surface: "var(--bg-1)",
        "surface-2": "var(--bg-2)",
        panel: "var(--panel)",
        "panel-strong": "var(--panel-strong)",
        "panel-soft": "var(--panel-soft)",
      },
      textColor: {
        foreground: "var(--text)",
        soft: "var(--text-soft)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
      },
      borderColor: {
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
      },

      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },

      borderRadius: {
        "4xl": "2rem",
      },

      boxShadow: {
        "panel": "0 1px 0 rgba(0,212,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
        "card": "0 1px 0 rgba(0,212,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
        "card-hover": "0 0 40px rgba(0,212,255,0.08), 0 16px 48px rgba(0,0,0,0.3)",
        "glow-cyan": "0 0 18px rgba(0,212,255,0.35)",
        "glow-purple": "0 0 18px rgba(168,85,247,0.35)",
        "glow-amber": "0 0 18px rgba(251,191,36,0.35)",
        "glow-sm": "0 0 8px rgba(0,212,255,0.2)",
      },

      keyframes: {
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.18s ease-out",
      },
    },
  },

  plugins: [
    require("tailwindcss/plugin")(function ({
      addUtilities,
      addComponents,
    }: {
      addUtilities: (utilities: Record<string, Record<string, string>>) => void;
      addComponents: (components: Record<string, Record<string, unknown>>) => void;
    }) {
      addUtilities({
        ".glass": {
          background: "rgba(8, 12, 30, 0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.12)",
        },
        ".glass-strong": {
          background: "rgba(10, 14, 32, 0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(0,212,255,0.25)",
        },
        ".glass-soft": {
          background: "rgba(8, 12, 30, 0.45)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(0,212,255,0.08)",
        },
        ".glow-cyan": {
          textShadow: "0 0 12px rgba(0,212,255,0.65)",
        },
        ".glow-purple": {
          textShadow: "0 0 12px rgba(168,85,247,0.65)",
        },
        ".glow-amber": {
          textShadow: "0 0 12px rgba(251,191,36,0.65)",
        },
        ".glow-success": {
          textShadow: "0 0 12px rgba(0,255,136,0.65)",
        },
        ".bg-void-gradient": {
          background: "#050510",
        },
      });

      addComponents({
        ".void-panel": {
          background: "rgba(8, 12, 30, 0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.12)",
          borderRadius: "20px",
          boxShadow: "0 0 40px rgba(0,212,255,0.04), 0 16px 48px rgba(0,0,0,0.25)",
        },
      });
    }),
  ],
};

export default config;
