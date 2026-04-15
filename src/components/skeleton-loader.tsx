"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-utils";
import { cn } from "@/lib/utils";

// ── Base skeleton block ───────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export function Skeleton({ className, style, "aria-label": ariaLabel }: SkeletonProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const anim = gsap.to(ref.current, {
      opacity: 0.4,
      duration: 0.75,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    return () => { anim.kill(); };
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      aria-label={ariaLabel ?? "Loading…"}
      aria-busy="true"
      className={cn("rounded-md", className)}
      style={{ ...style, background: "rgba(0,212,255,0.09)" }}
    />
  );
}

// ── Agent desk card skeleton ──────────────────────────────────────
export function AgentDeskCardSkeleton() {
  return (
    <div
      aria-label="Loading agent card…"
      aria-busy="true"
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "rgba(8,12,30,0.45)",
        border: "1px solid rgba(0,212,255,0.12)",
        minHeight: 200,
      }}
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Stats rows */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      {/* Action buttons */}
      <div className="flex gap-2 mt-auto">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}

// ── Role card skeleton (team page) ────────────────────────────────
export function RoleCardSkeleton() {
  return (
    <div
      aria-label="Loading role card…"
      aria-busy="true"
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "rgba(8,12,30,0.45)",
        border: "1px solid rgba(0,212,255,0.12)",
        minHeight: 180,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 mt-auto">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ── Calendar event list skeleton ──────────────────────────────────
export function CalendarEventSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading events…" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{
            background: "rgba(26,26,46,0.6)",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <Skeleton className="w-1 self-stretch rounded-full flex-shrink-0" style={{ minHeight: 36 }} />
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Cron job card skeleton ────────────────────────────────────────
export function CronJobSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading cron jobs…" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg p-3 flex flex-col gap-2"
          style={{
            background: "rgba(26,26,46,0.6)",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-56" />
        </div>
      ))}
    </div>
  );
}

// ── Stats bar skeleton ────────────────────────────────────────────
export function StatsBarSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "rgba(8,12,30,0.65)",
        border: "1px solid rgba(133,166,224,0.2)",
      }}
      aria-label="Loading stats…"
      aria-busy="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-20 rounded-full" />
      ))}
    </div>
  );
}

// ── Grid skeleton (wraps N card skeletons) ────────────────────────
export function AgentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AgentDeskCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RoleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <RoleCardSkeleton key={i} />
      ))}
    </div>
  );
}
