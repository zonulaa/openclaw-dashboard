"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
import { NAV_GROUPS } from "@/components/nav-routes";
import { gsap } from "@/lib/gsap-utils";
import { dashboardConfig } from "@/lib/config";

// ── Props ──────────────────────────────────────────────────────────
interface NavRailProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
}

// ── Main NavRail ───────────────────────────────────────────────────
export function NavRail({ collapsed, onToggle, mobileOpen, onMobileToggle }: NavRailProps) {
  const pathname = usePathname();

  // Keyboard toggle: `[` key
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "[") {
        e.preventDefault();
        onToggle();
      }
      if (e.key === "Escape") onMobileToggle(false);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onToggle]);

  // Close mobile sheet on route change
  useEffect(() => {
    onMobileToggle(false);
  }, [pathname, onMobileToggle]);

  // Backdrop click already handles closing the menu

  // GSAP: animate width on collapse/expand
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!asideRef.current) return;
    gsap.to(asideRef.current, {
      width: collapsed ? 64 : 240,
      duration: 0.2,
      ease: "power2.inOut",
    });
  }, [collapsed]);

  // GSAP: stagger entrance for nav items on mount
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!navRef.current) return;
    const items = navRef.current.querySelectorAll("li");
    const tween = gsap.fromTo(items,
      { opacity: 0, x: -12 },
      {
        opacity: 1,
        x: 0,
        duration: 0.3,
        stagger: 0.03,
        ease: "power2.out",
        delay: 0.15,
        clearProps: "opacity,transform,translate,rotate,scale",
      },
    );
    return () => {
      tween.kill();
      // Ensure items are visible if animation is interrupted (e.g. React StrictMode double-mount)
      gsap.set(items, { clearProps: "opacity,transform,translate,rotate,scale" });
    };
  }, []);

  return (
    <>
      {/* ── Desktop Rail ─────────────────────────────────────────── */}
      <aside
        ref={asideRef}
        aria-label="Primary navigation"
        className={[
          "hidden md:flex flex-col h-full shrink-0 relative z-50",
          "border-r-2 border-[rgba(0,212,255,0.25)]",
          "bg-[#0a0e1f]",
          "overflow-hidden",
          collapsed ? "w-16" : "w-60", // initial class, GSAP takes over
        ].join(" ")}
      >
        {/* Brand + toggle row */}
        <div
          className={[
            "flex items-center shrink-0 h-14",
            "border-b border-[rgba(0,212,255,0.12)] px-3",
            collapsed ? "justify-center" : "justify-between",
          ].join(" ")}
        >
          {collapsed ? (
            <Image
              src={dashboardConfig.logo}
              alt={`${dashboardConfig.title} logo`}
              width={32}
              height={32}
              className="rounded-full shrink-0"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <Image
                src={dashboardConfig.logo}
                alt={`${dashboardConfig.title} logo`}
                width={32}
                height={32}
                className="rounded-full shrink-0"
                style={{ objectFit: "cover" }}
              />
              <div className="min-w-0 overflow-hidden">
                <p className="text-[0.62rem] tracking-widest uppercase text-void-text-muted leading-none">
                  {dashboardConfig.title}
                </p>
                <p className="text-sm font-semibold text-void-text truncate mt-0.5 leading-snug">
                  {dashboardConfig.subtitle}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            title={collapsed ? "Expand nav  [" : "Collapse nav  ["}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={[
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
              "text-void-text-muted hover:text-void-text",
              "hover:bg-[rgba(0,212,255,0.06)]",
              "transition-colors duration-150",
            ].join(" ")}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        </div>

        {/* Nav groups */}
        <nav ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? "mt-5" : ""}>
              {/* Group label */}
              {!collapsed && (
                <p className="px-2 mb-1.5 text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-void-text-muted select-none">
                  {group.label}
                </p>
              )}
              {collapsed && gi > 0 && (
                <div className="my-2 mx-auto w-6 h-px bg-void-line" />
              )}

              <ul className="flex flex-col gap-0.5">
                {group.routes.map((route) => {
                  const isActive = pathname === route.href;
                  const Icon = route.icon;

                  return (
                    <li key={route.id}>
                      <Link
                        href={route.href}
                        title={collapsed ? route.title : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "group relative flex items-center gap-2.5 rounded-xl",
                          "transition-colors duration-150 ease-out",
                          collapsed ? "h-10 w-10 mx-auto justify-center" : "px-2.5 py-2 w-full",
                          isActive
                            ? [
                                "bg-[rgba(0,212,255,0.15)]",
                                "border border-[rgba(0,212,255,0.4)]",
                                "text-void-text",
                              ].join(" ")
                            : [
                                "border border-transparent text-void-text-soft",
                                "hover:text-void-text hover:bg-[rgba(0,212,255,0.08)]",
                                "hover:border-[rgba(0,212,255,0.12)]",
                              ].join(" "),
                        ].join(" ")}
                      >
                        {/* Active left glow bar */}
                        {isActive && !collapsed && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                            style={{ background: "rgba(0,212,255,0.9)", boxShadow: "0 0 8px rgba(0,212,255,0.7)" }}
                          />
                        )}

                        {/* Icon */}
                        <Icon
                          size={collapsed ? 18 : 16}
                          strokeWidth={isActive ? 2.2 : 1.8}
                          className="shrink-0"
                          aria-hidden="true"
                        />

                        {/* Label */}
                        {!collapsed && (
                          <span
                            className={[
                              "text-sm font-medium truncate transition-opacity duration-200",
                              isActive ? "text-void-text" : "",
                            ].join(" ")}
                          >
                            {route.title}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer hint */}
        {!collapsed && (
          <div className="shrink-0 px-3 py-2.5 border-t border-[rgba(0,212,255,0.12)]">
            <p className="text-[0.62rem] text-void-text-muted text-center select-none">
              Press <kbd className="font-mono bg-[rgba(0,212,255,0.08)] px-1 py-0.5 rounded text-[0.6rem]">[</kbd> to toggle
            </p>
          </div>
        )}
      </aside>

      {/* ── Mobile: Hamburger Menu Drawer (overlay sidebar) ────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 md:hidden z-[35] bg-[rgba(0,0,0,0.4)]"
            onClick={() => onMobileToggle(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            className="fixed left-0 top-0 bottom-0 md:hidden z-[45] w-60 overflow-y-auto"
            style={{
              background: "linear-gradient(180deg, rgba(5,5,16,0.95), rgba(5,5,16,0.98))",
              borderRight: "1px solid rgba(0,212,255,0.12)",
              marginTop: "56px", // below header
              pointerEvents: "auto",
            }}
            aria-label="Mobile navigation"
          >
            {/* Mobile nav groups */}
            <nav className="flex-1 overflow-y-auto py-3 px-2">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.id} className={gi > 0 ? "mt-5" : ""}>
                  {/* Group label */}
                  <p className="px-2 mb-1.5 text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-void-text-muted select-none">
                    {group.label}
                  </p>

                  <ul className="flex flex-col gap-0.5">
                    {group.routes.map((route) => {
                      const isActive = pathname === route.href;
                      const Icon = route.icon;

                      return (
                        <li key={route.id}>
                          <Link
                            href={route.href}
                            aria-current={isActive ? "page" : undefined}
                            className={[
                              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 w-full",
                              "transition-all duration-150",
                              isActive
                                ? [
                                    "bg-[rgba(0,212,255,0.15)]",
                                    "border border-[rgba(0,212,255,0.4)]",
                                    "text-void-text",
                                  ].join(" ")
                                : [
                                    "border border-transparent text-void-text-soft",
                                    "hover:text-void-text hover:bg-[rgba(0,212,255,0.08)]",
                                    "hover:border-[rgba(0,212,255,0.12)]",
                                  ].join(" "),
                            ].join(" ")}
                          >
                            <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" className="shrink-0" />
                            <span className="text-sm font-medium">{route.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
