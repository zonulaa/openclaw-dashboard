"use client";

import type { DeskStatus } from "./Desk";

type StatusBarProps = {
  status: DeskStatus;
};

const STATUS_CONFIG: Record<
  DeskStatus,
  { label: string; icon: string }
> = {
  working: { label: "WORKING", icon: "⚡" },
  idle: { label: "IDLE", icon: "💤" },
  thinking: { label: "THINKING", icon: "💭" },
  empty: { label: "EMPTY", icon: "🪑" },
};

export function StatusBar({ status }: StatusBarProps) {
  const { label, icon } = STATUS_CONFIG[status];

  return (
    <div
      className={`pixel-status pixel-status--${status}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      <span className="pixel-status__dot" aria-hidden="true" />
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
