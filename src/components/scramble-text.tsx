"use client";

import { useEffect, useRef } from "react";

const SCRAMBLE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

/**
 * ScrambleText — Reveals text character by character from random noise.
 * Works with any inline element via `as` prop.
 */
export function ScrambleText({
  text,
  as: Tag = "span",
  className = "",
  delay = 0,
}: {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const original = text;

    const timeout = setTimeout(() => {
      let iteration = 0;
      const interval = setInterval(() => {
        el.innerText = original
          .split("")
          .map((char, idx) => {
            if (char === " ") return " ";
            if (idx < iteration) return original[idx];
            return SCRAMBLE_CHARS[
              Math.floor(Math.random() * SCRAMBLE_CHARS.length)
            ];
          })
          .join("");
        if (iteration >= original.length) clearInterval(interval);
        iteration += 1 / 2;
      }, 30);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  // @ts-expect-error dynamic ref type
  return <Tag ref={ref} className={className}>{text}</Tag>;
}
