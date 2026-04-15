"use client";

/**
 * TaskCalendarSyncPanel
 *
 * Inline panel shown inside a task card (or task editor) to manage
 * Task↔Calendar Cross-Linking (Phase 4 Track 3).
 *
 * Features:
 * - Enable/disable sync toggle
 * - Sync mode selector (one-way / bi-directional)
 * - Conflict resolution selector
 * - Sync status badge (linked / error / none)
 * - Last sync timestamp
 * - Manual resync button
 * - Error display (yellow badge)
 */

import { useCallback, useEffect, useState } from "react";

export type SyncMode = "one-way" | "bi-directional";
export type ConflictResolution = "task-wins" | "calendar-wins" | "ask";

export type SyncStatus = {
  synced: boolean;
  calendarEventId: string | null;
  lastSyncAt: string | null;
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
  errors: Array<{ message: string; occurredAt: string; severity: "error" | "warning" }>;
  syncLocked?: boolean;
};

type Props = {
  taskId: string;
  taskTitle: string;
  /** Whether the task has a due date set */
  hasDueDate: boolean;
  /** Called when sync state changes (so parent can refresh) */
  onSyncChange?: () => void;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TaskCalendarSyncPanel({ taskId, taskTitle, hasDueDate, onSyncChange }: Props) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state for enabling sync
  const [showEnableForm, setShowEnableForm] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("one-way");
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>("task-wins");

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-status`, { cache: "no-store" });
      const data = (await res.json()) as SyncStatus & { ok?: boolean };
      if (data.ok !== false) {
        setStatus(data);
      }
    } catch {
      // ignore load errors silently
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const enableSync = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncMode, conflictResolution }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; calendarEventId?: string | null };
      if (!res.ok || !data.ok) {
        setActionError(data.error ?? "Failed to enable sync.");
      } else {
        setActionSuccess(
          data.calendarEventId
            ? `Sync enabled. Calendar event: ${data.calendarEventId}`
            : "Sync enabled. Calendar event will be created when due date is set.",
        );
        setShowEnableForm(false);
        await loadStatus();
        onSyncChange?.();
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, syncMode, conflictResolution, loadStatus, onSyncChange]);

  const disableSync = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsUnlinking(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-calendar`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(data.error ?? "Failed to unlink sync.");
      } else {
        setActionSuccess("Calendar sync unlinked.");
        await loadStatus();
        onSyncChange?.();
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setIsUnlinking(false);
    }
  }, [taskId, loadStatus, onSyncChange]);

  const manualResync = useCallback(async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        synced?: boolean;
        detached?: boolean;
        calendarEventId?: string | null;
      };
      if (!res.ok || !data.ok) {
        if (data.detached) {
          setActionSuccess("Calendar event was deleted. Sync detached.");
        } else {
          setActionError(data.error ?? "Resync failed.");
        }
      } else {
        setActionSuccess(`Resync successful. Event: ${data.calendarEventId ?? "created"}`);
        await loadStatus();
        onSyncChange?.();
      }
    } catch {
      setActionError("Network error during resync.");
    } finally {
      setIsSyncing(false);
    }
  }, [taskId, loadStatus, onSyncChange]);

  if (isLoading) {
    return <div className="sync-panel sync-panel-loading">⏳ Loading sync status…</div>;
  }

  const isSynced = status?.synced === true;
  const hasErrors = (status?.errors?.length ?? 0) > 0;

  return (
    <div className="sync-panel">
      {/* ── Status badge row ────────────────────────────────────────────── */}
      <div className="sync-panel-header">
        <span className="sync-icon" title="Calendar sync">
          📅
        </span>
        <span className="sync-label">
          {isSynced ? (
            <span className="sync-badge sync-badge-linked">🔗 Calendar linked</span>
          ) : hasErrors ? (
            <span className="sync-badge sync-badge-error">⚠️ Sync error</span>
          ) : (
            <span className="sync-badge sync-badge-none">Not synced</span>
          )}
        </span>
        {isSynced && status?.calendarEventId && (
          <span className="sync-meta" title={`Event ID: ${status.calendarEventId}`}>
            ID: {status.calendarEventId.slice(0, 12)}…
          </span>
        )}
      </div>

      {/* ── Last sync timestamp ──────────────────────────────────────────── */}
      {isSynced && status?.lastSyncAt && (
        <div className="sync-meta">
          Last synced: {formatShortDate(status.lastSyncAt)}
          {status.syncMode && (
            <span className="sync-mode-pill">
              {status.syncMode === "bi-directional" ? "↔ bi-directional" : "→ one-way"}
            </span>
          )}
        </div>
      )}

      {/* ── Sync errors (yellow badge) ───────────────────────────────────── */}
      {hasErrors && (
        <div className="sync-errors">
          {status!.errors.slice(0, 3).map((err, i) => (
            <div
              key={`${i}-${err.occurredAt}`}
              className={`sync-error-item ${err.severity === "warning" ? "sync-error-warning" : "sync-error-critical"}`}
            >
              {err.severity === "warning" ? "⚠️" : "❌"} {err.message}
              <span className="sync-meta"> ({formatShortDate(err.occurredAt)})</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Action feedback ─────────────────────────────────────────────── */}
      {actionError && <div className="sync-action-error">❌ {actionError}</div>}
      {actionSuccess && <div className="sync-action-success">✅ {actionSuccess}</div>}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="sync-actions">
        {isSynced ? (
          <>
            {/* Manual resync button */}
            <button
              type="button"
              className="sync-btn"
              onClick={() => void manualResync()}
              disabled={isSyncing || !!status?.syncLocked}
              title={status?.syncLocked ? "Sync locked — try again in 60s" : "Manually sync now"}
            >
              {isSyncing ? "⏳ Syncing…" : "🔄 Resync"}
            </button>

            {/* Unlink */}
            <button
              type="button"
              className="sync-btn sync-btn-danger"
              onClick={() => void disableSync()}
              disabled={isUnlinking}
            >
              {isUnlinking ? "Unlinking…" : "🔓 Unlink"}
            </button>
          </>
        ) : (
          <>
            {/* Enable sync */}
            <button
              type="button"
              className="sync-btn"
              onClick={() => setShowEnableForm((prev) => !prev)}
              disabled={!hasDueDate && !showEnableForm}
              title={!hasDueDate ? "Set a due date first to enable calendar sync" : "Enable calendar sync"}
            >
              📅 {showEnableForm ? "Cancel" : "Enable sync"}
            </button>
          </>
        )}
      </div>

      {/* ── Enable sync form ─────────────────────────────────────────────── */}
      {showEnableForm && !isSynced && (
        <div className="sync-enable-form">
          <div className="sync-form-row">
            <label className="sync-form-label" htmlFor={`sync-mode-${taskId}`}>
              Sync mode
            </label>
            <select
              id={`sync-mode-${taskId}`}
              className="sync-select"
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as SyncMode)}
            >
              <option value="one-way">One-way (task → calendar)</option>
              <option value="bi-directional">Bi-directional ↔</option>
            </select>
          </div>

          <div className="sync-form-row">
            <label className="sync-form-label" htmlFor={`conflict-${taskId}`}>
              Conflict resolution
            </label>
            <select
              id={`conflict-${taskId}`}
              className="sync-select"
              value={conflictResolution}
              onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
            >
              <option value="task-wins">Task wins (default)</option>
              <option value="calendar-wins">Calendar wins</option>
              <option value="ask">Ask (flag conflict)</option>
            </select>
          </div>

          {!hasDueDate && (
            <p className="sync-warning">
              ⚠️ No due date set on task &quot;{taskTitle}&quot;. Sync will be configured, but no calendar event
              will be created until a due date is added.
            </p>
          )}

          <button
            type="button"
            className="sync-btn sync-btn-primary"
            onClick={() => void enableSync()}
            disabled={isSyncing}
          >
            {isSyncing ? "⏳ Enabling…" : "✅ Confirm & enable sync"}
          </button>
        </div>
      )}
    </div>
  );
}
