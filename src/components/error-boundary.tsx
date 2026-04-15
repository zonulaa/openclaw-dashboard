"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

// ── Props & State ─────────────────────────────────────────────────
interface Props {
  children: ReactNode;
  /** Custom fallback UI. Receives error + reset handler. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Label for the section (shown in error UI and logs) */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ── Default fallback UI ───────────────────────────────────────────
function DefaultFallback({
  error,
  reset,
  label,
}: {
  error: Error;
  reset: () => void;
  label?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-xl px-4 py-5"
      style={{
        background: "rgba(255,176,174,0.06)",
        border: "1px solid rgba(255,176,174,0.3)",
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">⚠️</span>
        <span className="text-sm font-semibold" style={{ color: "#ffb0ae" }}>
          {label ? `${label}: Something went wrong` : "Something went wrong"}
        </span>
      </div>
      <p className="text-xs" style={{ color: "#475569" }}>
        {error.message || "An unexpected error occurred in this section."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{
          background: "rgba(119,173,255,0.15)",
          border: "1px solid rgba(119,173,255,0.4)",
          color: "#77adff",
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ── Error Boundary class component ───────────────────────────────
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? "unknown section";
    // Log for debugging without leaking to production console in non-dev
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ErrorBoundary:${label}]`, error, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <DefaultFallback
          error={this.state.error}
          reset={this.reset}
          label={this.props.label}
        />
      );
    }
    return this.props.children;
  }
}

// ── Convenience wrapper for sections ─────────────────────────────
export function SafeSection({
  children,
  label,
  fallback,
}: {
  children: ReactNode;
  label?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}) {
  return (
    <ErrorBoundary label={label} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}
