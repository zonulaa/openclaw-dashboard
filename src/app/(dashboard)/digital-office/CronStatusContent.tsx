"use client";

import { useCallback, useState } from "react";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";

// ── Types ─────────────────────────────────────────────────────────
type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  scheduleExpr: string;
  scheduleTz: string;
  scheduleHuman: string;
  model: string | null;
  payloadKind: string;
  lastRunStatus: string | null;
  lastRunAtMs: number | null;
  nextRunAtMs: number | null;
  lastDurationMs: number | null;
  consecutiveErrors: number;
};

type CronsData = {
  ok: boolean;
  jobs: CronJob[];
  error?: string;
};

// ── Colors ────────────────────────────────────────────────────────
const C = {
  bg: "#1A1A2E",
  card: "#1E1E34",
  border: "rgba(0,212,255,0.12)",
  green: "#00FF9F",
  text: "#c8deff",
  muted: "#475569",
  dim: "#5e7299",
  red: "#ffb0ae",
  yellow: "#fbbf24",
} as const;

// ── Friendly name map ─────────────────────────────────────────────
const CRON_NAMES: Record<string, string> = {
  "morning-briefing": "☀️ Morning Briefing",
  "nightly-summary-approval-first": "🌙 Nightly Summary",
  "autonomous-nightly-1-step-general-sonnet": "🤖 2AM Autonomous",
  "overnight-feature-test": "🧪 5AM Feature Test",
  "Agent-btc-trader": "📈 Agent BTC Trader",
  "heartbeat": "💓 Heartbeat",
};

function friendlyName(name: string): string {
  return CRON_NAMES[name] ?? name;
}

// ── Time helpers ──────────────────────────────────────────────────
function fmtRelative(ms: number | null): string {
  if (ms == null) return "Never";
  const diff = Date.now() - ms;
  if (diff < 0) return "upcoming";
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function fmtNext(ms: number | null): string {
  if (ms == null) return "—";
  const diff = ms - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60000) return "< 1m";
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return `in ${Math.floor(diff / 86400000)}d`;
}

function statusColor(status: string | null, neverRan: boolean, errors: number): string {
  if (neverRan) return C.yellow;
  if (errors > 0 || status === "error" || status === "fail") return C.red;
  if (status === "ok" || status === "success" || status === "completed") return C.green;
  return C.muted;
}

function statusLabel(status: string | null, neverRan: boolean, errors: number): string {
  if (neverRan) return "Never ran";
  if (errors > 0) return `${errors} errors`;
  if (!status) return "Unknown";
  return status;
}

// ── Cron Card ─────────────────────────────────────────────────────
function CronCard({ job }: { job: CronJob }) {
  const neverRan = job.lastRunAtMs == null;
  const color = statusColor(job.lastRunStatus, neverRan, job.consecutiveErrors);

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${color === C.red ? "rgba(255,176,174,0.25)" : color === C.green ? "rgba(0,255,159,0.15)" : C.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {friendlyName(job.name)}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace" }}>
            {job.scheduleHuman || job.scheduleExpr}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 99,
              background: color === C.red ? "rgba(255,51,102,0.1)" : color === C.green ? "rgba(0,255,159,0.1)" : "rgba(251,191,36,0.1)",
              border: `1px solid ${color === C.red ? "rgba(255,176,174,0.3)" : color === C.green ? "rgba(0,255,159,0.3)" : "rgba(251,191,36,0.3)"}`,
              color,
              fontFamily: "Courier New, monospace",
            }}
          >
            {statusLabel(job.lastRunStatus, neverRan, job.consecutiveErrors)}
          </span>
          {!job.enabled && (
            <span style={{ fontSize: 9, color: C.dim, fontFamily: "Courier New, monospace" }}>disabled</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Last run</p>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontFamily: "Courier New, monospace" }}>
            {fmtRelative(job.lastRunAtMs)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Next run</p>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontFamily: "Courier New, monospace" }}>
            {fmtNext(job.nextRunAtMs)}
          </p>
        </div>
        {job.lastDurationMs != null && (
          <div>
            <p style={{ margin: 0, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Duration</p>
            <p style={{ margin: 0, fontSize: 12, color: C.muted, fontFamily: "Courier New, monospace" }}>
              {job.lastDurationMs < 1000
                ? `${job.lastDurationMs}ms`
                : `${Math.round(job.lastDurationMs / 1000)}s`}
            </p>
          </div>
        )}
        {job.model && (
          <div>
            <p style={{ margin: 0, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Model</p>
            <p style={{ margin: 0, fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {job.model.replace("anthropic/", "")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function CronStatusContent() {
  const [data, setData] = useState<CronsData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crons", { cache: "no-store" });
      const json = (await res.json()) as CronsData;
      setData(json);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const { isLoading, isRefreshing, lastUpdated } = useVisibilityPolling(load, {
    intervalMs: 30000,
  });

  const fmtRelativeStr = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const jobs = data?.jobs ?? [];
  const errorCount = jobs.filter((j) => j.consecutiveErrors > 0 || j.lastRunStatus === "error").length;
  const okCount = jobs.filter((j) => j.lastRunStatus === "ok" || j.lastRunStatus === "success" || j.lastRunStatus === "completed").length;
  const neverCount = jobs.filter((j) => j.lastRunAtMs == null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
            Scheduled Jobs
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: "Courier New, monospace", margin: 0 }}>
            CRON STATUS
          </h2>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", textAlign: "right" }}>
          {isRefreshing ? "Refreshing…" : lastUpdated ? `Updated ${fmtRelativeStr(lastUpdated)}` : ""}
        </div>
      </div>

      {/* Summary pills */}
      {jobs.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 99,
            background: "rgba(0,255,159,0.08)", border: "1px solid rgba(0,255,159,0.2)", color: C.green,
          }}>
            ✓ {okCount} ok
          </span>
          {errorCount > 0 && (
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 99,
              background: "rgba(255,176,174,0.08)", border: "1px solid rgba(255,176,174,0.3)", color: C.red,
            }}>
              ✗ {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {neverCount > 0 && (
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 99,
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: C.yellow,
            }}>
              ○ {neverCount} never ran
            </span>
          )}
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 99,
            background: "rgba(0,212,255,0.09)", border: `1px solid ${C.border}`, color: C.muted,
          }}>
            {jobs.length} total
          </span>
        </div>
      )}

      {/* Loading/Error states */}
      {isLoading && jobs.length === 0 && (
        <div style={{ padding: "2rem", color: C.dim, fontFamily: "Courier New, monospace", fontSize: 12, textAlign: "center" }}>
          Loading cron jobs…
        </div>
      )}

      {error && (
        <div style={{
          background: C.card, border: "1px solid rgba(255,176,174,0.3)", borderRadius: 10,
          padding: 16, color: C.red, fontSize: 12, fontFamily: "Courier New, monospace",
        }}>
          ⚠ Error: {error}
        </div>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "32px", textAlign: "center", color: C.dim, fontSize: 13,
          fontFamily: "Courier New, monospace",
        }}>
          ⏰ No cron jobs found
          <br />
          <span style={{ fontSize: 10, marginTop: 4, display: "block" }}>
            Gateway may not be reachable or no jobs are configured
          </span>
        </div>
      )}

      {/* Cron Grid */}
      {jobs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {jobs.map((job) => (
            <CronCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
