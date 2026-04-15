"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-utils";
import { cn } from "@/lib/utils";

// ── Props ───────────────────────────────────────────────────────────
interface LoaderProps {
  /** Visual size of the spinner */
  size?: "xs" | "sm" | "md" | "lg";
  /** Color variant */
  variant?: "cyan" | "amber" | "muted" | "white";
  /** Additional class names */
  className?: string;
  /** Accessible label (defaults to "Loading…") */
  label?: string;
}

// ── Size map ────────────────────────────────────────────────────────
const sizeMap: Record<NonNullable<LoaderProps["size"]>, string> = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

// ── Color map ───────────────────────────────────────────────────────
const colorMap: Record<NonNullable<LoaderProps["variant"]>, string> = {
  cyan: "border-[var(--accent)] border-t-transparent",
  amber: "border-[#fbbf24] border-t-transparent",
  muted: "border-[var(--text-muted)] border-t-transparent",
  white: "border-white border-t-transparent",
};

// ── Component ───────────────────────────────────────────────────────
export function Loader({
  size = "md",
  variant = "cyan",
  className,
  label = "Loading…",
}: LoaderProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const anim = gsap.to(ref.current, {
      rotation: 360,
      duration: 0.8,
      repeat: -1,
      ease: "none",
    });
    return () => { anim.kill(); };
  }, []);

  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn(
        "inline-block rounded-full",
        sizeMap[size],
        colorMap[variant],
        className
      )}
    />
  );
}

// ── Full-area overlay loader ─────────────────────────────────────────
interface LoaderOverlayProps {
  label?: string;
  className?: string;
}

export function LoaderOverlay({ label = "Loading…", className }: LoaderOverlayProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3",
        "text-sm text-[var(--text-muted)]",
        className
      )}
    >
      <Loader size="md" variant="cyan" label={label} />
      <span>{label}</span>
    </div>
  );
}
