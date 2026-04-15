"use client";

import { useCallback, useMemo, useState } from "react";

import { RoleCard, type SpawnState } from "@/components/team/role-card";
import { UnassignedSessions } from "@/components/team/unassigned-sessions";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import { matchSessionsToRoles, type MatchableMember } from "@/lib/team-session-matcher";
import { RoleGridSkeleton } from "@/components/skeleton-loader";

// ── Live status types ────────────────────────────────────────────────
type CronJob = {
  id: string; name: string; schedule: string; tz: string;
  enabled: boolean; lastRunAt: string | null; lastStatus: string;
  nextRunAt: string | null; model: string;
};
type LiveSession = {
  id: string; label: string; state: string; model: string;
  isMain: boolean; updatedAt: string; runtime: string;
};
type TaskSummary = { total: number; done: number; inProgress: number; todo: number };
type TeamStatus = {
  fetchedAt: string;
  cronJobs: CronJob[]; sessions: LiveSession[]; tasks: TaskSummary;
};

// ── Live Status Panel ─────────────────────────────────────────────────
function LiveStatusPanel({ status }: { status: TeamStatus | null }) {
  if (!status) return null;

  const CARD = {
    background: "linear-gradient(180deg,rgba(30,30,52,0.95),rgba(26,26,46,0.98))",
    border: "1px solid rgba(0,212,255,0.12)",
    borderRadius: 12,
  } as const;

  const chip = (label: string, value: string | number, color = "#475569") => (
    <span key={label} className="inline-flex items-center gap-1 text-[0.68rem]" style={{ color: "#5e7299" }}>
      {label}:&nbsp;<span style={{ color, fontWeight: 600 }}>{value}</span>
    </span>
  );

  const cronNameMap: Record<string, string> = {
    "morning-briefing": "☀️ Morning Briefing",
    "nightly-summary-approval-first": "🌙 Nightly Summary",
    "autonomous-nightly-1-step-general-sonnet": "🤖 2AM Autonomous",
    "overnight-feature-test": "🧪 5AM Feature Test",
  };

  const _fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const fmtRelative = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const statusColor = (s: string) => {
    if (s === "ok" || s === "clean") return "#7fe1b8";
    if (s === "error" || s === "fail") return "#ffb0ae";
    return "#fbbf24";
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-widest" style={{ color: "#5e7299" }}>
        Live Status
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Orchestrator */}
        <div className="flex flex-col gap-2 p-3 rounded-xl" style={CARD}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🤖</span>
            <span className="text-[0.78rem] font-bold" style={{ color: "#c8deff" }}>Orchestrator</span>
            <span className="ml-auto text-[0.62rem] rounded-full px-2 py-0.5"
              style={{ background: "rgba(127,225,184,0.12)", border: "1px solid rgba(127,225,184,0.3)", color: "#7fe1b8" }}>
              online
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {chip("Sessions", status.sessions.filter(s => s.isMain).length + " main")}
            {chip("Subagents", status.sessions.filter(s => !s.isMain).length)}
            {chip("Tasks", `${status.tasks.inProgress} active / ${status.tasks.todo} todo`)}
          </div>
        </div>

        {/* Task Board */}
        <div className="flex flex-col gap-2 p-3 rounded-xl" style={CARD}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>📋</span>
            <span className="text-[0.78rem] font-bold" style={{ color: "#c8deff" }}>Task Board</span>
          </div>
          <div className="flex flex-col gap-1">
            {chip("Total", status.tasks.total)}
            {chip("Done", status.tasks.done, "#7fe1b8")}
            {chip("In progress", status.tasks.inProgress, "#77adff")}
            {chip("Todo", status.tasks.todo, "#fbbf24")}
          </div>
        </div>

        {/* Cron Jobs */}
        <div className="flex flex-col gap-2 p-3 rounded-xl" style={CARD}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>⏰</span>
            <span className="text-[0.78rem] font-bold" style={{ color: "#c8deff" }}>Scheduled Jobs</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {status.cronJobs.slice(0, 4).map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-2">
                <span className="text-[0.65rem] truncate" style={{ color: "#475569" }}>
                  {cronNameMap[job.name] ?? job.name}
                </span>
                <span className="text-[0.6rem] shrink-0" style={{ color: statusColor(job.lastStatus) }}>
                  {fmtRelative(job.lastRunAt)}
                </span>
              </div>
            ))}
            {status.cronJobs.length === 0 && (
              <span className="text-[0.65rem]" style={{ color: "#5e7299" }}>No jobs found</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────

type RoleSpawnPreset = {
  runtime?: string;
  model?: string;
  timeoutSeconds?: number;
  profile?: string;
  defaultTaskTemplate?: string;
};

type TeamRole = {
  id: string;
  title: string;
  ownerType: "me" | "worker";
  focus: string;
  responsibilities: string[];
  spawnPreset?: RoleSpawnPreset;
  agentId?: string;
};

type TeamStructure = {
  version: number;
  updatedAt: string;
  roles: TeamRole[];
};

type OfficeMember = {
  id: string;
  name: string;
  role: string;
  workstation?: string;
  source: "live" | "mock";
  status: string;
  live?: {
    sessionId: string;
    runtime?: string;
    model?: string;
    parentSessionId?: string;
    isMain: boolean;
    uptimeMs?: number;
    uptimeHuman?: string;
    startedAt?: string;
    agentId?: string;
  };
};

// ── Page component ───────────────────────────────────────────────────

export default function TeamStructureContent() {
  const [structure, setStructure] = useState<TeamStructure | null>(null);
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [note, setNote] = useState("Loading role map…");
  const [taskOverrides, setTaskOverrides] = useState<Record<string, string>>({});
  const [dryRunByRole, setDryRunByRole] = useState<Record<string, boolean>>({});
  const [spawnState, setSpawnState] = useState<Record<string, SpawnState>>({});
  const [liveStatus, setLiveStatus] = useState<TeamStatus | null>(null);

  // ── Data fetching: roles + live sessions + live status in parallel ───
  const load = useCallback(async () => {
    const [structureRes, officeRes, statusRes] = await Promise.all([
      fetch("/api/team-structure", { cache: "no-store" }),
      fetch("/api/digital-office", { cache: "no-store" }),
      fetch("/api/team-status", { cache: "no-store" }),
    ]);

    const structureData = (await structureRes.json()) as { structure?: TeamStructure };
    const officeData = (await officeRes.json()) as {
      members?: OfficeMember[];
      degraded?: boolean;
    };
    const statusData = (await statusRes.json()) as TeamStatus;

    if (structureRes.ok && structureData.structure) {
      setStructure(structureData.structure);
    }

    setMembers(Array.isArray(officeData.members) ? officeData.members : []);
    setDegraded(Boolean(officeData.degraded));
    if (statusRes.ok) setLiveStatus(statusData);

    if (structureData.structure) {
      setNote(`Updated ${new Date(structureData.structure.updatedAt).toLocaleString()}`);
    } else {
      setNote("Failed to load team structure.");
    }
  }, []);

  const { isLoading, isRefreshing, lastUpdated, isVisible } = useVisibilityPolling(load, {
    intervalMs: 15000,
  });

  // ── Session ↔ Role matching ────────────────────────────────────────
  const matchedMembers: MatchableMember[] = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        workstation: m.workstation,
        source: m.source,
        status: m.status,
        live: m.live
          ? {
              ...m.live,
              agentId: m.live.agentId,
            }
          : undefined,
      })),
    [members],
  );

  const matchResult = useMemo(() => {
    if (!structure) return null;
    return matchSessionsToRoles(structure.roles, matchedMembers);
  }, [structure, matchedMembers]);

  // ── Spawn action ──────────────────────────────────────────────────
  const runSpawn = async (roleId: string, dryRun: boolean) => {
    const taskOverride = (taskOverrides[roleId] || "").trim();

    setSpawnState((prev) => ({
      ...prev,
      [roleId]: { loading: true, mode: dryRun ? "dryRun" : "spawn", at: new Date().toISOString() },
    }));

    try {
      const res = await fetch("/api/team-structure/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, task: taskOverride || undefined, dryRun }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        dryRun?: boolean;
        payload?: unknown;
        sessionId?: string;
        runId?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) throw new Error(data.error || "Spawn request failed");

      setSpawnState((prev) => ({
        ...prev,
        [roleId]: {
          loading: false,
          mode: dryRun ? "dryRun" : "spawn",
          sessionId: data.sessionId ?? null,
          runId: data.runId ?? null,
          payload: data.payload,
          at: new Date().toISOString(),
        },
      }));
    } catch (err) {
      setSpawnState((prev) => ({
        ...prev,
        [roleId]: {
          loading: false,
          mode: dryRun ? "dryRun" : "spawn",
          error: err instanceof Error ? err.message : "Unknown error",
          at: new Date().toISOString(),
        },
      }));
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────
  const summary = useMemo(() => {
    const roles = structure?.roles || [];
    const leads = roles.filter((r) => r.ownerType === "me").length;
    const liveCount = members.filter((m) => m.source === "live").length;
    return {
      total: roles.length,
      leads,
      workers: roles.length - leads,
      liveCount,
      degraded,
    };
  }, [structure, members, degraded]);

  // ── Render helpers ────────────────────────────────────────────────

  const statusBadge = (label: string, value: string | number) => (
    <span
      key={label}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-medium"
      style={{
        background: "rgba(8,12,30,0.6)",
        border: "1px solid rgba(0,212,255,0.12)",
        color: "#475569",
      }}
    >
      <span style={{ color: "#5e7299" }}>{label}</span>
      <span style={{ color: "#c8deff", fontWeight: 600 }}>{value}</span>
    </span>
  );

  // ── Empty state ───────────────────────────────────────────────────
  const renderEmpty = () => (
    <div
      className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
      style={{
        background: "rgba(8,12,30,0.45)",
        border: "1px solid rgba(0,212,255,0.12)",
      }}
    >
      <span className="text-3xl" aria-hidden="true">🏗️</span>
      <p className="text-sm font-medium" style={{ color: "#475569" }}>
        {isLoading ? "Loading team structure…" : "No team roles defined yet"}
      </p>
      <p className="text-xs" style={{ color: "#5e7299" }}>
        {isLoading
          ? "Fetching role map and live sessions…"
          : "Add roles to your team structure to see them here."}
      </p>
    </div>
  );

  const roles = structure?.roles || [];

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-6xl mx-auto w-full">
      {/* ── Header ── */}
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-widest mb-1" style={{ color: "#5e7299" }}>
          Team · Roles
        </p>
        <h1 className="text-xl font-bold" style={{ color: "#00FF9F", fontFamily: "Courier New, monospace", letterSpacing: "0.05em" }}>
          TEAM STRUCTURE
        </h1>
        <p className="text-[0.75rem] mt-1" style={{ color: "#5e7299" }}>
          Role map with live session visibility. See which agents are running under each role.
        </p>
      </div>
      {/* ── Status bar ── */}
      <div className="flex flex-wrap items-center gap-2" role="status" aria-label="Team structure status">
        {statusBadge(
          "Status",
          isLoading ? "Loading…" : isRefreshing ? "Refreshing…" : "Live",
        )}
        {statusBadge("Roles", summary.total)}
        {statusBadge("Lead / Worker", `${summary.leads} / ${summary.workers}`)}
        {statusBadge("Live sessions", summary.liveCount)}
        {lastUpdated && statusBadge("Updated", new Date(lastUpdated).toLocaleTimeString())}
        {!isVisible && (
          <span
            className="text-[0.66rem] rounded-full px-2.5 py-1"
            style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.3)",
              color: "#fbbf24",
            }}
          >
            Paused (tab hidden)
          </span>
        )}
        {degraded && (
          <span
            className="text-[0.66rem] rounded-full px-2.5 py-1"
            style={{
              background: "rgba(255,176,174,0.08)",
              border: "1px solid rgba(255,176,174,0.3)",
              color: "#ffb0ae",
            }}
          >
            ⚠ Sessions: degraded mode
          </span>
        )}
      </div>

      {/* ── Note / feedback line ── */}
      {note && !isLoading && (
        <p className="text-xs" style={{ color: "#5e7299" }} aria-live="polite">
          {note}
        </p>
      )}

      {/* ── Live Status Panel ── */}
      <LiveStatusPanel status={liveStatus} />

      {/* ── Role cards grid ── */}
      {isLoading && roles.length === 0 ? (
        <RoleGridSkeleton count={6} />
      ) : roles.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            role="list"
            aria-label="Team role cards"
          >
            {roles.map((role) => {
              const liveSessions = matchResult?.roleToMembers.get(role.id) ?? [];
              return (
                <RoleCard
                  key={role.id}
                  role={role}
                  liveSessions={liveSessions}
                  spawnState={spawnState[role.id]}
                  taskOverride={taskOverrides[role.id] || ""}
                  dryRunDefault={Boolean(dryRunByRole[role.id])}
                  onTaskOverrideChange={(id, val) =>
                    setTaskOverrides((prev) => ({ ...prev, [id]: val }))
                  }
                  onDryRunDefaultToggle={(id, val) =>
                    setDryRunByRole((prev) => ({ ...prev, [id]: val }))
                  }
                  onSpawn={(id, dry) => void runSpawn(id, dry)}
                />
              );
            })}
          </div>

          {/* ── Unassigned sessions ── */}
          {matchResult && matchResult.unassigned.length > 0 && (
            <UnassignedSessions sessions={matchResult.unassigned} />
          )}

          {/* ── All agents idle state ── */}
          {summary.liveCount === 0 && !isLoading && !degraded && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: "rgba(26,26,46,0.6)",
                border: "1px solid rgba(0,212,255,0.12)",
              }}
            >
              <span className="text-lg" aria-hidden="true">🌙</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold" style={{ color: "#475569" }}>
                  All agents idle
                </span>
                <span className="text-[0.66rem]" style={{ color: "#5e7299" }}>
                  No live sessions detected. Use spawn controls to start a new session under any role.
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
