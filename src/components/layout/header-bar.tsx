"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, Moon, Sun, Monitor, Wifi, WifiOff, Menu } from "lucide-react";
import { NAV_ROUTES } from "@/components/nav-routes";
import { CreateEventHeaderButton } from "@/components/layout/create-event-button";
import { gsap, fadeIn } from "@/lib/gsap-utils";

// ── Types ──────────────────────────────────────────────────────────
interface HeaderBarProps {
  /** Eyebrow label shown above the page title (e.g. "Dashboard") */
  eyebrow?: string;
  /** Page title shown in the left section */
  title?: string;
  /** Extra actions rendered on the right (e.g. refresh buttons) */
  actions?: ReactNode;
  /** Mobile nav state */
  mobileOpen?: boolean;
  onMobileToggle?: (open: boolean) => void;
}

type ThemeMode = "dark" | "light" | "system";

// ── Command Palette ────────────────────────────────────────────────
function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  const filtered = NAV_ROUTES.filter(
    (r) =>
      query === "" ||
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.summary.toLowerCase().includes(query.toLowerCase())
  );

  const paletteRef = useRef<HTMLDivElement>(null);

  // GSAP: palette entrance
  useEffect(() => {
    if (!open || !paletteRef.current) return;
    gsap.fromTo(paletteRef.current, { opacity: 0, scale: 0.95, y: -10 }, { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: "power2.out" });
    return () => { /* cleanup */ };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-[rgba(4,7,14,0.72)] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette panel */}
      <div
        ref={paletteRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={[
          "fixed left-1/2 top-[20%] -translate-x-1/2 z-[91]",
          "w-full max-w-md",
          "void-panel",
          "overflow-hidden",
        ].join(" ")}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[rgba(0,212,255,0.12)]">
          <Search size={16} className="text-void-text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to page…"
            className={[
              "flex-1 bg-transparent text-sm text-void-text placeholder:text-void-text-muted",
              "outline-none border-none caret-cyan",
            ].join(" ")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                router.push(filtered[0].href);
                onClose();
              }
            }}
          />
          <kbd className="text-[0.6rem] text-void-text-muted bg-[rgba(32,45,70,0.5)] px-1.5 py-1 rounded font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <ul className="py-2 max-h-72 overflow-y-auto" role="listbox">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-void-text-muted text-center">
              No results
            </li>
          )}
          {filtered.map((route) => {
            const Icon = route.icon;
            return (
              <li key={route.id} role="option" aria-selected="false">
                <button
                  onClick={() => {
                    router.push(route.href);
                    onClose();
                  }}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2.5",
                    "text-left text-sm transition-colors duration-100",
                    "hover:bg-[rgba(0,212,255,0.06)] hover:text-cyan",
                    "text-void-text-soft",
                  ].join(" ")}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-void-text-muted" />
                  <span className="font-medium text-void-text">{route.title}</span>
                  <span className="text-void-text-muted text-[0.72rem] truncate ml-auto">
                    {route.summary}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[rgba(0,212,255,0.12)] flex items-center gap-3 text-[0.62rem] text-void-text-muted">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> go</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}

// ── Digital Clock ─────────────────────────────────────────────────
function DigitalClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="font-mono text-sm tabular-nums text-void-text-soft select-none"
      aria-label="Current time"
    >
      {time}
    </span>
  );
}

// ── Theme Cycle Button ────────────────────────────────────────────
function ThemeButton() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  const cycle = () => {
    setMode((m) => {
      const next: ThemeMode = m === "dark" ? "light" : m === "light" ? "system" : "dark";
      // TODO: wire to next-themes when installed
      return next;
    });
  };

  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  const label = `Theme: ${mode}`;

  return (
    <button
      onClick={cycle}
      title={label}
      aria-label={label}
      className={[
        "flex items-center justify-center w-8 h-8 rounded-lg",
        "text-void-text-muted hover:text-void-text",
        "hover:bg-[rgba(0,212,255,0.06)]",
        "transition-colors duration-150",
      ].join(" ")}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

// ── Connection Status Dot ─────────────────────────────────────────
function ConnectionDot() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <span
      aria-label={online ? "Connected" : "Offline"}
      title={online ? "Connected" : "Offline"}
      className="flex items-center gap-1.5"
    >
      {online ? (
        <Wifi size={13} className="text-success" aria-hidden="true" />
      ) : (
        <WifiOff size={13} className="text-danger" aria-hidden="true" />
      )}
      <span
        className={[
          "w-1.5 h-1.5 rounded-full",
          online
            ? "bg-success shadow-[0_0_6px_rgba(127,225,184,0.9)]"
            : "bg-danger shadow-[0_0_6px_rgba(255,176,174,0.9)]",
        ].join(" ")}
        aria-hidden="true"
      />
    </span>
  );
}

// ── Header Bar ────────────────────────────────────────────────────
export function HeaderBar({ eyebrow, title, actions, mobileOpen = false, onMobileToggle }: HeaderBarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Open palette with Cmd+K or `/` (when not in input)
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/" && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [paletteOpen]);

  return (
    <>
      {/* ── Fixed top bar ───────────────────────────────────────── */}
      <header
        className={[
          "fixed top-0 right-0 left-0 z-40 h-14",
          "glass border-b border-[rgba(0,212,255,0.12)]",
          "flex items-center gap-3 px-4",
          "md:left-[var(--nav-rail-width,0px)]",
        ].join(" ")}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Left: hamburger menu (mobile only) + title area */}
        <button
          onClick={() => onMobileToggle?.(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-void-text-muted hover:text-void-text hover:bg-[rgba(0,212,255,0.06)] transition-colors duration-150 mr-2 relative z-[50]"
          style={{ position: "relative", zIndex: 50 }}
        >
          <Menu size={18} />
        </button>

        <div className="flex flex-col min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.6rem] tracking-widest uppercase text-void-text-muted leading-none mb-0.5 select-none">
              {eyebrow}
            </p>
          )}
          {title && (
            <h1 className="text-sm font-semibold text-void-text truncate leading-snug">
              {title}
            </h1>
          )}
        </div>

        {/* Center: command palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette (⌘K)"
          className={[
            "hidden sm:flex items-center gap-2",
            "h-8 px-3 rounded-lg",
            "bg-[rgba(26,26,46,0.6)] border border-[rgba(0,212,255,0.12)]",
            "text-void-text-muted text-xs",
            "hover:border-[rgba(119,173,255,0.4)] hover:text-void-text",
            "transition-all duration-150 cursor-pointer",
            "min-w-[180px] max-w-[260px]",
          ].join(" ")}
        >
          <Search size={13} aria-hidden="true" className="shrink-0" />
          <span className="flex-1 text-left">Go to page…</span>
          <span className="flex items-center gap-1 shrink-0">
            <kbd className="font-mono text-[0.58rem] bg-[rgba(32,45,70,0.5)] px-1 py-0.5 rounded">⌘</kbd>
            <kbd className="font-mono text-[0.58rem] bg-[rgba(32,45,70,0.5)] px-1 py-0.5 rounded">K</kbd>
          </span>
        </button>

        {/* Right: clock, connection, theme, actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ConnectionDot />
          <DigitalClock />
          <ThemeButton />
          <CreateEventHeaderButton />
          {actions && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-[rgba(0,212,255,0.12)]">
              {actions}
            </div>
          )}
        </div>
      </header>

      {/* Spacer so page content doesn't hide behind fixed bar */}
      <div className="h-14 shrink-0" aria-hidden="true" />

      {/* Command palette portal */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
}
