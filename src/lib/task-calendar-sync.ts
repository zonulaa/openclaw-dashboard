/**
 * Task↔Calendar Cross-Linking — Sync Model & Store
 *
 * Manages the sync configuration, history, and logic for linking
 * tasks to calendar events with bidirectional sync support.
 */

import { readJsonFile, writeJsonFile } from "@/lib/local-data";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncMode = "one-way" | "bi-directional";
export type ConflictResolution = "task-wins" | "calendar-wins" | "ask";
export type SyncErrorSeverity = "error" | "warning";

export type SyncError = {
  message: string;
  occurredAt: string;
  severity: SyncErrorSeverity;
};

export type TaskCalendarSync = {
  /** The task this sync belongs to */
  taskId: string;
  /** Linked calendar event ID (may be null if not yet created) */
  calendarEventId: string | null;
  /** Sync direction: one-way (task→calendar) or bi-directional */
  syncMode: SyncMode;
  /** What to do when both sides changed simultaneously */
  conflictResolution: ConflictResolution;
  /** ISO string of last successful sync */
  lastSyncAt: string | null;
  /** ISO string when sync was first set up */
  createdAt: string;
  /** ISO string of last update */
  updatedAt: string;
  /** Whether this sync config is active */
  active: boolean;
  /** Recent sync errors (last 10) */
  errors: SyncError[];
  /**
   * Anti-loop guard: when one side triggers a sync, we record
   * the source so the other side doesn't cascade.
   * Value is epoch ms of when the lock expires.
   */
  syncLockUntil: number | null;
  /** Which side triggered the current/last sync */
  lastSyncSource: "task" | "calendar" | "manual" | null;
};

export type TaskCalendarSyncStore = {
  syncs: TaskCalendarSync[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FILE_NAME = "task-calendar-sync.json";
const SYNC_DEBOUNCE_MS = 60_000; // 60 s anti-loop guard
const MAX_ERRORS_PER_SYNC = 10;

const EMPTY_STORE: TaskCalendarSyncStore = { syncs: [] };

// ─── Store I/O ────────────────────────────────────────────────────────────────

export async function readSyncStore(): Promise<TaskCalendarSyncStore> {
  const raw = await readJsonFile<Partial<TaskCalendarSyncStore>>(FILE_NAME, EMPTY_STORE);
  return {
    syncs: Array.isArray(raw?.syncs) ? raw.syncs : [],
  };
}

export async function writeSyncStore(store: TaskCalendarSyncStore): Promise<void> {
  await writeJsonFile(FILE_NAME, store);
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function findSyncByTaskId(store: TaskCalendarSyncStore, taskId: string): TaskCalendarSync | null {
  return store.syncs.find((s) => s.taskId === taskId && s.active) ?? null;
}

export function findSyncByCalendarEventId(
  store: TaskCalendarSyncStore,
  calendarEventId: string,
): TaskCalendarSync | null {
  return store.syncs.find((s) => s.calendarEventId === calendarEventId && s.active) ?? null;
}

// ─── Lock helpers (anti-cascade) ─────────────────────────────────────────────

/**
 * Returns true if a sync is currently locked (prevents cascade loops).
 */
export function isSyncLocked(sync: TaskCalendarSync): boolean {
  if (!sync.syncLockUntil) return false;
  return Date.now() < sync.syncLockUntil;
}

/**
 * Acquire a 60-second sync lock to prevent bidirectional cascade loops.
 */
export function acquireSyncLock(
  sync: TaskCalendarSync,
  source: "task" | "calendar" | "manual",
): TaskCalendarSync {
  return {
    ...sync,
    syncLockUntil: Date.now() + SYNC_DEBOUNCE_MS,
    lastSyncSource: source,
  };
}

/**
 * Release an existing sync lock.
 */
export function releaseSyncLock(sync: TaskCalendarSync): TaskCalendarSync {
  return {
    ...sync,
    syncLockUntil: null,
  };
}

// ─── Error recording ─────────────────────────────────────────────────────────

export function appendSyncError(
  sync: TaskCalendarSync,
  message: string,
  severity: SyncErrorSeverity = "error",
): TaskCalendarSync {
  const newError: SyncError = {
    message,
    occurredAt: new Date().toISOString(),
    severity,
  };
  const errors = [newError, ...sync.errors].slice(0, MAX_ERRORS_PER_SYNC);
  return { ...sync, errors };
}

export function clearSyncErrors(sync: TaskCalendarSync): TaskCalendarSync {
  return { ...sync, errors: [] };
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

/**
 * Create or update a sync config for a task.
 * If a sync already exists for the task, it is updated in-place.
 */
export function upsertSync(
  store: TaskCalendarSyncStore,
  config: {
    taskId: string;
    calendarEventId?: string | null;
    syncMode: SyncMode;
    conflictResolution: ConflictResolution;
  },
): { store: TaskCalendarSyncStore; sync: TaskCalendarSync } {
  const now = new Date().toISOString();
  const existing = store.syncs.findIndex((s) => s.taskId === config.taskId);

  let sync: TaskCalendarSync;
  if (existing >= 0) {
    sync = {
      ...store.syncs[existing],
      calendarEventId: config.calendarEventId ?? store.syncs[existing].calendarEventId,
      syncMode: config.syncMode,
      conflictResolution: config.conflictResolution,
      active: true,
      updatedAt: now,
    };
    const newSyncs = [...store.syncs];
    newSyncs[existing] = sync;
    return { store: { ...store, syncs: newSyncs }, sync };
  }

  sync = {
    taskId: config.taskId,
    calendarEventId: config.calendarEventId ?? null,
    syncMode: config.syncMode,
    conflictResolution: config.conflictResolution,
    lastSyncAt: null,
    createdAt: now,
    updatedAt: now,
    active: true,
    errors: [],
    syncLockUntil: null,
    lastSyncSource: null,
  };

  return {
    store: { ...store, syncs: [sync, ...store.syncs] },
    sync,
  };
}

/**
 * Deactivate a sync (unlink), without deleting history.
 */
export function deactivateSync(
  store: TaskCalendarSyncStore,
  taskId: string,
): { store: TaskCalendarSyncStore; found: boolean } {
  const idx = store.syncs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return { store, found: false };

  const updated = {
    ...store.syncs[idx],
    active: false,
    updatedAt: new Date().toISOString(),
  };
  const newSyncs = [...store.syncs];
  newSyncs[idx] = updated;
  return { store: { ...store, syncs: newSyncs }, found: true };
}

/**
 * Update a sync's calendarEventId + lastSyncAt after a successful sync.
 */
export function recordSuccessfulSync(
  store: TaskCalendarSyncStore,
  taskId: string,
  calendarEventId: string,
): { store: TaskCalendarSyncStore; sync: TaskCalendarSync | null } {
  const idx = store.syncs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return { store, sync: null };

  const now = new Date().toISOString();
  const sync: TaskCalendarSync = {
    ...store.syncs[idx],
    calendarEventId,
    lastSyncAt: now,
    updatedAt: now,
    errors: [], // clear errors on success
    syncLockUntil: null,
  };
  const newSyncs = [...store.syncs];
  newSyncs[idx] = sync;
  return { store: { ...store, syncs: newSyncs }, sync };
}

/**
 * Record a sync error on a sync config.
 */
export function recordSyncError(
  store: TaskCalendarSyncStore,
  taskId: string,
  message: string,
  severity: SyncErrorSeverity = "error",
): { store: TaskCalendarSyncStore; sync: TaskCalendarSync | null } {
  const idx = store.syncs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return { store, sync: null };

  const sync = appendSyncError(store.syncs[idx], message, severity);
  const newSyncs = [...store.syncs];
  newSyncs[idx] = sync;
  return { store: { ...store, syncs: newSyncs }, sync };
}

// ─── Timezone utilities ────────────────────────────────────────────────────────

/**
 * Normalize any date input to a UTC ISO string.
 * Returns null if the input is empty or unparseable.
 */
export function normalizeToUtcIso(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Format an ISO date for display in a given timezone (IANA tz string).
 * Falls back to UTC if tz is unknown.
 */
export function formatInTimezone(isoString: string, tz = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toUTCString();
  }
}

/**
 * Convert a local datetime-local input value (YYYY-MM-DDTHH:mm)
 * to an ISO string, treating the local value as being in the given tz.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function localInputToUtcIso(localValue: string, _tz = "UTC"): string | null {
  if (!localValue) return null;
  try {
    // `new Date(localValue)` treats the input as local/UTC time on the server.
    // For now we return the ISO string directly; for full TZ-aware conversion,
    // use a library like `date-fns-tz` or `luxon`.
    const naive = new Date(localValue);
    if (Number.isNaN(naive.getTime())) return null;
    return naive.toISOString();
  } catch {
    return null;
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function isSyncMode(value: unknown): value is SyncMode {
  return value === "one-way" || value === "bi-directional";
}

export function isConflictResolution(value: unknown): value is ConflictResolution {
  return value === "task-wins" || value === "calendar-wins" || value === "ask";
}
