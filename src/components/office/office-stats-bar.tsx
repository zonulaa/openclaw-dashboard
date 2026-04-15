"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PresenceTone } from "@/components/ui/presence-badge";

// Use a local filter tone that only includes the tones used in the office filter
type OfficeTone = "working" | "focus" | "idle" | "queued";

// ── Types ────────────────────────────────────────────────────────────
export interface OfficeStatsBarProps {
  totalCount: number;
  activeCount: number;
  focusCount: number;
  idleCount: number;
  queuedCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: string | number | null;
  isVisible: boolean;

  // Filter
  activeFilter: PresenceTone | "all";
  onFilterChange: (filter: PresenceTone | "all") => void;

  // Bulk controls
  selectedCount: number;
  selectableCount: number;
  bulkBusy: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDryRun: () => void;
  onBulkStop: () => void;

  // Refresh
  onRefresh: () => void;
  refreshBusy: boolean;

  className?: string;
}

// ── Filter tab ───────────────────────────────────────────────────────
const FILTERS: { key: OfficeTone | "all"; label: string; color: string }[] = [
  { key: "all", label: "All", color: "#475569" },
  { key: "working", label: "Working", color: "rgba(0,212,255,0.9)" },
  { key: "focus", label: "Focus", color: "#fbbf24" },
  { key: "idle", label: "Idle", color: "#475569" },
  { key: "queued", label: "Queued", color: "#a78bfa" },
];

function FilterTab({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide transition-all duration-150"
      style={{
        background: active ? `${color}18` : "rgba(8,12,30,0.45)",
        border: active ? `1px solid ${color}60` : "1px solid rgba(0,212,255,0.12)",
        color: active ? color : "#6880a8",
        boxShadow: active ? `0 0 8px ${color}22` : "none",
      }}
    >
      {label}
      <span
        className="rounded-full px-1.5 py-px text-[0.6rem] font-bold"
        style={{
          background: active ? `${color}25` : "rgba(0,212,255,0.08)",
          color: active ? color : "#6880a8",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────
export function OfficeStatsBar({
  totalCount,
  activeCount,
  focusCount,
  idleCount,
  queuedCount,
  isLoading,
  isRefreshing,
  lastUpdated,
  isVisible,
  activeFilter,
  onFilterChange,
  selectedCount,
  selectableCount,
  bulkBusy,
  onSelectAll,
  onClearSelection,
  onBulkDryRun,
  onBulkStop,
  onRefresh,
  refreshBusy,
  className,
}: OfficeStatsBarProps) {
  const filterCounts: Record<OfficeTone | "all", number> = {
    all: totalCount,
    working: activeCount,
    focus: focusCount,
    idle: idleCount,
    queued: queuedCount,
  };

  const statusText = isLoading
    ? "Loading…"
    : isRefreshing
      ? "Refreshing…"
      : !isVisible
        ? "Paused (tab hidden)"
        : "Live · 15s";

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      style={{
        background: "rgba(26,26,46,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: 14,
        padding: "0.85rem 1rem",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* ── Row 1: Title + status + refresh ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2
          className="text-sm font-bold uppercase tracking-wider shrink-0"
          style={{ color: "#00d4ff" }}
        >
          Digital Office
        </h2>

        {/* Live status pill */}
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold"
          style={{
            background: isLoading || isRefreshing ? "rgba(251,191,36,0.1)" : "rgba(0,212,255,0.08)",
            border: isLoading || isRefreshing ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(0,212,255,0.25)",
            color: isLoading || isRefreshing ? "#fbbf24" : "#77adff",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: isLoading || isRefreshing ? "#fbbf24" : "rgba(0,212,255,0.9)",
              animation: "presence-dot-pulse 2s ease-in-out infinite",
            }}
          />
          {statusText}
        </span>

        {/* Last updated */}
        {lastUpdated && (
          <span className="text-[0.65rem]" style={{ color: "#5e7299" }}>
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* At-desk counter */}
        <span
          className="text-[0.72rem] font-semibold tabular-nums"
          style={{ color: "#475569" }}
        >
          <span style={{ color: "rgba(0,212,255,0.9)" }}>{activeCount + focusCount}</span>
          <span style={{ color: "#5e7299" }}> / {totalCount} at desk</span>
        </span>

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshBusy || isLoading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.71rem] font-semibold transition-all duration-150"
          style={{
            background: "rgba(15,20,33,0.8)",
            border: "1px solid rgba(125,153,202,0.4)",
            color: "#94a3b8",
            opacity: refreshBusy || isLoading ? 0.6 : 1,
            cursor: refreshBusy || isLoading ? "not-allowed" : "pointer",
          }}
        >
          <span
            className={cn("text-base leading-none", (refreshBusy || isRefreshing) && "animate-spin-slow")}
            aria-hidden="true"
          >
            ↻
          </span>
          {refreshBusy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Row 2: Filter tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ key, label, color }) => (
          <FilterTab
            key={key}
            label={label}
            count={filterCounts[key]}
            active={activeFilter === key}
            color={color}
            onClick={() => onFilterChange(key as PresenceTone | "all")}
          />
        ))}
      </div>

      {/* ── Row 3: Bulk controls (only visible when selectable workers exist) ── */}
      {selectableCount > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap pt-1 border-t"
          style={{ borderColor: "rgba(0,212,255,0.12)" }}
        >
          <span className="text-[0.65rem] font-semibold" style={{ color: "#6880a8" }}>
            Bulk:
          </span>
          <span className="text-[0.65rem]" style={{ color: "#475569" }}>
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={onSelectAll}
            disabled={bulkBusy || selectableCount === 0}
            className="text-[0.65rem] font-semibold rounded-full px-2.5 py-0.5 transition-colors"
            style={{
              background: "rgba(8,12,30,0.55)",
              border: "1px solid rgba(0,212,255,0.12)",
              color: "#475569",
              opacity: bulkBusy ? 0.5 : 1,
              cursor: bulkBusy ? "not-allowed" : "pointer",
            }}
          >
            Select all stoppable
          </button>
          {selectedCount > 0 && (
            <>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={bulkBusy}
                className="text-[0.65rem] font-semibold rounded-full px-2.5 py-0.5 transition-colors"
                style={{
                  background: "rgba(8,12,30,0.55)",
                  border: "1px solid rgba(0,212,255,0.12)",
                  color: "#475569",
                  opacity: bulkBusy ? 0.5 : 1,
                  cursor: bulkBusy ? "not-allowed" : "pointer",
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onBulkDryRun}
                disabled={bulkBusy}
                className="text-[0.65rem] font-semibold rounded-full px-2.5 py-0.5 transition-colors"
                style={{
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(254,240,138,0.3)",
                  color: "#fef08a",
                  opacity: bulkBusy ? 0.5 : 1,
                  cursor: bulkBusy ? "not-allowed" : "pointer",
                }}
              >
                {bulkBusy ? "Running…" : "Dry-run"}
              </button>
              <button
                type="button"
                onClick={onBulkStop}
                disabled={bulkBusy}
                className="text-[0.65rem] font-semibold rounded-full px-2.5 py-0.5 transition-colors"
                style={{
                  background: "linear-gradient(180deg, #77adff, #4e89e8)",
                  color: "#050510",
                  opacity: bulkBusy ? 0.5 : 1,
                  cursor: bulkBusy ? "not-allowed" : "pointer",
                }}
              >
                {bulkBusy ? "Stopping…" : `Stop ${selectedCount}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
