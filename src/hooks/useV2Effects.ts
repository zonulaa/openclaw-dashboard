"use client";

import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";

interface UseV2TiltOptions {
  maxTilt?: number;     // max degrees (default 8)
  perspective?: number; // px (default 1000)
  scale?: number;       // hover scale (default 1)
  speed?: number;       // transition speed (default 0.2)
  snapBack?: boolean;   // elastic snap back (default true)
}

/**
 * useV2Tilt — Applies 3D perspective tilt to an element on mouse move.
 * Add `ref` to any card container.
 */
export function useV2Tilt<T extends HTMLElement>(opts: UseV2TiltOptions = {}) {
  const ref = useRef<T>(null);
  const { maxTilt = 8, perspective = 1000, speed = 0.2, snapBack = true } = opts;

  const handleMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateX = (y - 0.5) * -maxTilt;
      const rotateY = (x - 0.5) * maxTilt;
      gsap.to(el, {
        rotateX,
        rotateY,
        duration: speed,
        ease: "power1.out",
        transformPerspective: perspective,
      });
    },
    [maxTilt, perspective, speed]
  );

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      rotateX: 0,
      rotateY: 0,
      duration: snapBack ? 0.6 : 0.3,
      ease: snapBack ? "elastic.out(1, 0.5)" : "power2.out",
    });
  }, [snapBack]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [handleMove, handleLeave]);

  return ref;
}

/**
 * useV2Magnet — Makes an element follow the cursor slightly on hover.
 */
export function useV2Magnet<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);

  const handleMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.3,
        ease: "power2.out",
      });
    },
    [strength]
  );

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [handleMove, handleLeave]);

  return ref;
}
