// ── Dashboard Configuration ─────────────────────────────────────────
// Reads branding from environment variables so any OpenClaw user can
// customise the dashboard without touching source code.

export const dashboardConfig = {
  title: process.env.NEXT_PUBLIC_DASHBOARD_TITLE || process.env.DASHBOARD_TITLE || "OpenClaw Dashboard",
  logo: process.env.NEXT_PUBLIC_DASHBOARD_LOGO || process.env.DASHBOARD_LOGO || "/logo.png",
  accentColor: process.env.NEXT_PUBLIC_DASHBOARD_ACCENT_COLOR || process.env.DASHBOARD_ACCENT_COLOR || "#FF6B2B",
  ownerName: process.env.NEXT_PUBLIC_OWNER_NAME || process.env.OWNER_NAME || "Owner",
  subtitle: process.env.NEXT_PUBLIC_DASHBOARD_SUBTITLE || process.env.DASHBOARD_SUBTITLE || "Mission Control",
} as const;
