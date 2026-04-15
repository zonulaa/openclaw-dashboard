import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Tailwind-aware class name merger.
 *
 * Combines clsx (conditional classes, arrays, objects) with
 * tailwind-merge (deduplicates conflicting Tailwind utilities).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-cyan/10", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
