import type { ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────
interface ScreenWrapperProps {
  /** Small label above the title (e.g. "Core · Dashboard") */
  eyebrow?: string;
  /** Page/section heading */
  title: string;
  /** Supporting description below the title */
  description?: string;
  /** Action buttons / controls shown in the header row */
  actions?: ReactNode;
  /** Page body content */
  children?: ReactNode;
  /** Optional max width override (Tailwind class, e.g. "max-w-5xl") */
  maxWidth?: string;
}

// ── ScreenWrapper ─────────────────────────────────────────────────
/**
 * Standard page container. Replaces the old `ScreenShell` component.
 *
 * Usage:
 * ```tsx
 * <ScreenWrapper
 *   eyebrow="Core"
 *   title="Task Board"
 *   description="Track active work and execution lanes."
 *   actions={<RefreshButton />}
 * >
 *   {children}
 * </ScreenWrapper>
 * ```
 */
export function ScreenWrapper({
  eyebrow,
  title,
  description,
  actions,
  children,
  maxWidth = "max-w-5xl",
}: ScreenWrapperProps) {
  return (
    <section className={`w-full ${maxWidth} mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5`}>
      {/* Page header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          {eyebrow && (
            <p className="text-[0.62rem] tracking-widest uppercase text-void-text-muted font-semibold leading-none select-none">
              {eyebrow}
            </p>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-void-text tracking-tight leading-tight m-0">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-void-text-soft max-w-prose leading-relaxed m-0">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </header>

      {/* Page content */}
      {children && (
        <div className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </section>
  );
}
