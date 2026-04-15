"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { gsap } from "@/lib/gsap-utils";

// ── Button variants via CVA ─────────────────────────────────────────
const buttonVariants = cva(
  // Base styles — shared by all variants
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-[10px] px-4 py-2",
    "text-sm font-semibold leading-none",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(120,164,255,0.68)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none cursor-pointer",
  ],
  {
    variants: {
      variant: {
        /** Primary — cyan gradient, dark text */
        default: [
          "bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]",
          "text-[#050510]",
          "border border-transparent",
          "hover:brightness-110 active:brightness-95",
          "shadow-sm shadow-[rgba(119,173,255,0.2)]",
        ],
        /** Outlined — transparent bg, cyan border */
        outline: [
          "bg-transparent",
          "text-[var(--accent)]",
          "border border-[rgba(119,173,255,0.45)]",
          "hover:bg-[rgba(119,173,255,0.08)] hover:border-[rgba(0,212,255,0.65)]",
          "active:bg-[rgba(119,173,255,0.14)]",
        ],
        /** Ghost — no border, subtle hover */
        ghost: [
          "bg-transparent",
          "text-[var(--text-soft)]",
          "border border-transparent",
          "hover:bg-[rgba(119,173,255,0.08)] hover:text-[var(--text)]",
          "active:bg-[rgba(119,173,255,0.14)]",
        ],
        /** Destructive — red tone */
        destructive: [
          "bg-[rgba(255,100,100,0.1)]",
          "text-[var(--danger)]",
          "border border-[rgba(255,100,100,0.36)]",
          "hover:bg-[rgba(255,100,100,0.18)] hover:border-[rgba(255,100,100,0.56)]",
          "active:bg-[rgba(255,100,100,0.24)]",
        ],
        /** Secondary — subdued panel style */
        secondary: [
          "bg-[rgba(15,20,33,0.8)]",
          "text-[var(--text-soft)]",
          "border border-[rgba(125,153,202,0.4)]",
          "hover:bg-[rgba(25,35,55,0.85)] hover:text-[var(--text)]",
        ],
      },
      size: {
        sm: "h-7 px-3 text-xs rounded-lg",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base rounded-xl",
        icon: "h-9 w-9 p-0 rounded-lg",
        "icon-sm": "h-7 w-7 p-0 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// ── Props ───────────────────────────────────────────────────────────
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a loading spinner and disable interaction */
  loading?: boolean;
}

// ── Component ───────────────────────────────────────────────────────
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    const btnRef = React.useRef<HTMLButtonElement | null>(null);

    // GSAP: press feedback
    const handleMouseDown = React.useCallback(() => {
      if (!btnRef.current || disabled || loading) return;
      gsap.to(btnRef.current, { scale: 0.97, duration: 0.08, ease: 'power2.out' });
    }, [disabled, loading]);

    const handleMouseUp = React.useCallback(() => {
      if (!btnRef.current) return;
      gsap.to(btnRef.current, { scale: 1, duration: 0.15, ease: 'back.out(1.5)' });
    }, []);

    const setRefs = React.useCallback((node: HTMLButtonElement | null) => {
      btnRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    }, [ref]);

    return (
      <button
        ref={setRefs}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
