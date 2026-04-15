/**
 * themes.ts — Void palette color token system
 *
 * Single source of truth for design tokens.
 * These match the CSS variables in globals.css and tailwind.config.ts.
 * Use these tokens in JS/TS contexts (inline styles, canvas, SVG, etc.)
 */

// ── Background Layers ──────────────────────────────────────────────
export const voidBg = {
  /** Deepest background — page body */
  0: "#050510",
  /** Slightly lighter — secondary surfaces */
  1: "#0a0e1f",
  /** Tertiary surfaces — modals, popovers */
  2: "#111633",
} as const;

// ── Panel Surfaces (with alpha) ─────────────────────────────────────
export const voidPanel = {
  /** Default panel — sidebar, cards */
  DEFAULT: "rgba(10, 15, 24, 0.86)",
  /** Strong panel — overlays, dropdowns */
  strong: "rgba(16, 23, 36, 0.95)",
  /** Soft panel — subtle backgrounds */
  soft: "rgba(17, 24, 37, 0.76)",
} as const;

// ── Border / Divider ────────────────────────────────────────────────
export const voidLine = {
  DEFAULT: "rgba(133, 166, 224, 0.25)",
  strong: "rgba(150, 184, 238, 0.42)",
} as const;

// ── Text ────────────────────────────────────────────────────────────
export const voidText = {
  /** Primary text — headings, labels */
  DEFAULT: "#e2e8f0",
  /** Secondary text — descriptions */
  soft: "#94a3b8",
  /** Tertiary text — timestamps, hints */
  muted: "#475569",
} as const;

// ── Accent Colors ───────────────────────────────────────────────────
export const accent = {
  /** Cyan — primary interactive accent */
  cyan: {
    DEFAULT: "#77adff",
    dim: "#4e89e8",
    bright: "#a8c8ff",
  },
  /** Amber — secondary / warning accent */
  amber: {
    DEFAULT: "#fbbf24",
    dim: "#d97706",
    bright: "#fde68a",
  },
} as const;

// ── Status Accent Overlays ──────────────────────────────────────────
// Semi-transparent fills for badges, highlights, and status indicators.
// These mirror the CSS variables in globals.css.
export const accentOverlay = {
  red: "rgba(214, 48, 49, 0.4)",
  green: "rgba(0, 184, 148, 0.4)",
  blue: "rgba(9, 132, 227, 0.4)",
  teal: "rgba(0, 184, 169, 0.4)",
  purple: "rgba(108, 92, 231, 0.4)",
} as const;

// ── Semantic Colors ─────────────────────────────────────────────────
export const semantic = {
  success: "#7fe1b8",
  warning: "#fef08a",
  danger: "#ffb0ae",
  info: "#77adff",
} as const;

// ── Agent Avatar Colors ─────────────────────────────────────────────
// Deterministic color assignment for agent/user avatars.
// Cycle through this palette based on index or name hash.
export const avatarPalette = [
  { bg: "rgba(78, 137, 232, 0.22)", border: "rgba(119, 173, 255, 0.5)", text: "#a8c8ff" },  // cyan
  { bg: "rgba(127, 225, 184, 0.18)", border: "rgba(127, 225, 184, 0.45)", text: "#7fe1b8" }, // green
  { bg: "rgba(251, 191, 36, 0.16)", border: "rgba(251, 191, 36, 0.4)", text: "#fde68a" },   // amber
  { bg: "rgba(167, 139, 250, 0.18)", border: "rgba(167, 139, 250, 0.4)", text: "#c4b5fd" }, // violet
  { bg: "rgba(251, 113, 133, 0.18)", border: "rgba(251, 113, 133, 0.4)", text: "#fda4af" }, // rose
  { bg: "rgba(56, 189, 248, 0.18)", border: "rgba(56, 189, 248, 0.4)", text: "#7dd3fc" },   // sky
] as const;

/**
 * Get a deterministic avatar color from the palette based on a string.
 * Useful for assigning consistent colors to agents by name.
 */
export function getAvatarColor(seed: string): (typeof avatarPalette)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length];
}

// ── Full palette export (convenience) ──────────────────────────────
export const voidPalette = {
  bg: voidBg,
  panel: voidPanel,
  line: voidLine,
  text: voidText,
  accent,
  accentOverlay,
  semantic,
} as const;

export type VoidPalette = typeof voidPalette;
