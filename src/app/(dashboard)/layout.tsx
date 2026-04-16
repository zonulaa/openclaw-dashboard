"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { NavRail } from "@/components/layout/nav-rail";
import { HeaderBar } from "@/components/layout/header-bar";
import { CreateEventFAB, CreateEventKeyboardShortcut } from "@/components/layout/create-event-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { usePathname } from "next/navigation";
import { NAV_ROUTES } from "@/components/nav-routes";
import { V2GlobalEffects } from "@/components/v2-overlay";
import { VoiceChatFAB } from "@/components/voice-chat/VoiceChatFAB";

// Lazy-load the heavy CreateEventModal (562 lines) — only needed when user opens it
const CreateEventModal = dynamic(
  () => import("@/components/modals/create-event-modal").then((m) => m.CreateEventModal),
  { ssr: false },
);

// ── NavRail width constants ────────────────────────────────────────
const RAIL_EXPANDED = 240; // px — must match w-60 (15rem = 240px)
const RAIL_COLLAPSED = 64;  // px — must match w-16 (4rem  = 64px)

// ── Resolve page title from pathname ──────────────────────────────
function usePageMeta() {
  const pathname = usePathname();
  const route = NAV_ROUTES.find((r) => r.href === pathname);
  return {
    title: route?.title ?? "Dashboard",
    eyebrow: route?.group
      ? route.group.charAt(0) + route.group.slice(1).toLowerCase()
      : "Dashboard",
  };
}

// ── NavRail fallback (minimal safe version shown if NavRail crashes) ──
function NavRailFallback() {
  return (
    <div
      className="flex flex-col items-center justify-start gap-4 py-4 flex-shrink-0"
      style={{
        width: RAIL_COLLAPSED,
        background: "rgba(5,5,16,0.96)",
        borderRight: "1px solid rgba(0,212,255,0.12)",
      }}
      aria-label="Navigation unavailable"
    >
      <span className="text-xl" aria-hidden="true">🧭</span>
    </div>
  );
}

// ── Dashboard Layout ──────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { title, eyebrow } = usePageMeta();

  // Persist collapsed state across page navigations
  useEffect(() => {
    const stored = localStorage.getItem("nav-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("nav-collapsed", String(next));
      return next;
    });
  }

  const railWidth = collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED;

  return (
    <ToastProvider>
    {/* V2 Global Effects — aurora, cursor glow, data stream, ripple, magnetic, card effects */}
    <V2GlobalEffects />
    <div className="flex h-screen overflow-hidden" style={{ position: 'relative', zIndex: 2 }}>
      {/* ── Left NavRail (desktop) + Mobile Drawer ────────────── */}
      <ErrorBoundary
        label="NavRail"
        fallback={() => <NavRailFallback />}
      >
        <NavRail
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          mobileOpen={mobileOpen}
          onMobileToggle={setMobileOpen}
        />
      </ErrorBoundary>

      {/* ── Main column ──────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Fixed top HeaderBar — offset handled via CSS var */}
        <style>{`:root { --nav-rail-width: ${railWidth}px; }`}</style>

        <ErrorBoundary label="HeaderBar">
          <HeaderBar
            eyebrow={eyebrow}
            title={title}
            mobileOpen={mobileOpen}
            onMobileToggle={setMobileOpen}
          />
        </ErrorBoundary>

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          id="main-content"
          tabIndex={-1}
          aria-label="Main content"
        >
          <ErrorBoundary label="Page content">
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Global: Create Event FAB (mobile), Modal, Keyboard shortcut ── */}
      <ErrorBoundary label="CreateEventModal">
        <CreateEventFAB />
        <CreateEventModal />
        <CreateEventKeyboardShortcut />
      </ErrorBoundary>

      {/* ── Floating Voice Chat Widget Toggle ── */}
      <ErrorBoundary label="VoiceChatFAB">
        <VoiceChatFAB />
      </ErrorBoundary>
    </div>
    </ToastProvider>
  );
}
