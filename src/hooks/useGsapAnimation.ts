/**
 * React hooks for GSAP animations in User Control dashboard.
 *
 * Usage:
 *   import { useGsapEntrance, useScrollReveal, useStaggerList } from "@/hooks/useGsapAnimation";
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap-utils";

type Vars = gsap.TweenVars;

// ---------------------------------------------------------------------------
// useGsapEntrance  — one-shot entrance animation on mount
// ---------------------------------------------------------------------------
/**
 * Run a GSAP animation on mount with automatic cleanup.
 *
 * @param factory  - function receiving the container ref, returns a GSAP tween/timeline
 * @param deps     - re-run when these change (default [])
 */
export function useGsapEntrance(
  factory: (el: HTMLDivElement) => gsap.core.Timeline | gsap.core.Tween | void,
  deps: React.DependencyList = [],
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const anim = factory(ref.current);
    return () => {
      anim?.kill?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

// ---------------------------------------------------------------------------
// useScrollReveal  — trigger animation when element enters viewport
// ---------------------------------------------------------------------------
export function useScrollReveal(
  vars?: Vars,
  options?: ScrollTrigger.Vars,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.from(ref.current!, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current!,
          start: "top 85%",
          once: true,
          ...options,
        },
        ...vars,
      });
    });

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

// ---------------------------------------------------------------------------
// useStaggerList  — stagger-animate children of a container
// ---------------------------------------------------------------------------
/**
 * @param selector - CSS selector for the child items (scoped to container)
 * @param vars     - tween vars (default: opacity 0→1, y 10→0, stagger 0.08)
 * @param deps     - re-run when these change
 */
export function useStaggerList(
  selector: string,
  vars?: Vars,
  deps: React.DependencyList = [],
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const items = ref.current.querySelectorAll(selector);
    if (!items.length) return;

    const ctx = gsap.context(() => {
      gsap.from(items, {
        opacity: 0,
        y: 10,
        duration: 0.35,
        stagger: 0.08,
        ease: "power2.out",
        ...vars,
      });
    }, ref);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

// ---------------------------------------------------------------------------
// useGsapTimeline — build a reusable timeline with cleanup
// ---------------------------------------------------------------------------
export function useGsapTimeline(
  builder: (tl: gsap.core.Timeline, container: HTMLDivElement) => void,
  deps: React.DependencyList = [],
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const tl = gsap.timeline({ paused: false });
    const ctx = gsap.context(() => {
      builder(tl, ref.current!);
    }, ref);

    return () => {
      tl.kill();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export { gsap, ScrollTrigger };
