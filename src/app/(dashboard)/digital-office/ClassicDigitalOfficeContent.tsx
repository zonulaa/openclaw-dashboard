"use client";

import { useCallback, useMemo, useState } from "react";

import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import { AgentDeskCard } from "@/components/office/agent-desk-card";
import { OfficeStatsBar } from "@/components/office/office-stats-bar";
import { HierarchyTree } from "@/components/office/hierarchy-tree";
import type { HierarchyRole } from "@/components/office/hierarchy-tree";
import { AgentGridSkeleton, StatsBarSkeleton } from "@/components/skeleton-loader";
import type { PresenceTone } from "@/components/ui/presence-badge";
import { GalaxyRoom } from "@/components/galaxy-office/GalaxyRoom";

// ── Types ────────────────────────────────────────────────────────────
type OfficeMember = {
  id: string;
  name: string;
  role: string;
  workstation: string;
  avatar: string;
  source: "live" | "mock";
  status: string;
  statusDetail?: string;
  runningFrom?: string;
  details: string;
  live?: {
    sessionId: string;
    runtime?: string;
    model?: string;
    parentSessionId?: string;
    isMain: boolean;
    sourceMethod?: string;
    updatedAt?: string;
    startedAt?: string;
    uptimeMs?: number;
    uptimeHuman?: string;
    rawKey?: string;
  };
  ops: {
    canRefresh: boolean;
    canStop: boolean;
    stopGuard: string | null;
  };
};

type TeamRole = {
  id: string;
  title: string;
  ownerType?: "me" | "worker";
  focus?: string;
  parentId?: string | null;
  subAgents?: string[];
};

type OfficeMeta = {
  sessionMethodsTried?: string[];
  subagentMethodsTried?: string[];
  methodErrors?: string[];
  fetchedAt?: string;
};

type OfficeMemberView = OfficeMember & {
  teamRoleId: string | null;
  teamRoleTitle: string | null;
  presenceTone: PresenceTone;
  presenceLabel: string;
  deskLabel: string;
};

type BulkSummary = {
  requested: number;
  allowed: number;
  blocked: number;
  dryRun: boolean;
  stopped: number;
  failed: number;
};

type BulkResult = {
  memberId: string;
  sessionId?: string;
  allowed: boolean;
  reason?: string;
  stopped?: boolean;
  usedMethod?: string;
  errors?: string[];
};

// ── Presence inference ────────────────────────────────────────────────
const ACTIVE_TERMS = ["active", "running", "busy", "online", "working"];
const FOCUS_TERMS = ["focus", "coding", "writing", "design", "research"];
const QUEUE_TERMS = ["queued", "waiting", "pending"];

function inferTone(statusRaw: string): PresenceTone {
  const status = statusRaw.toLowerCase();
  if (ACTIVE_TERMS.some((term) => status.includes(term))) return "working";
  if (FOCUS_TERMS.some((term) => status.includes(term))) return "focus";
  if (QUEUE_TERMS.some((term) => status.includes(term))) return "queued";
  return "idle";
}

function toneLabel(tone: PresenceTone): string {
  if (tone === "working") return "Working at desk";
  if (tone === "focus") return "Heads-down focus";
  if (tone === "queued") return "Queued for next task";
  return "Idle / standing by";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findRole(member: OfficeMember, roles: TeamRole[]): TeamRole | null {
  const joined = normalize(`${member.name} ${member.role} ${member.workstation}`);
  return roles.find((role) => joined.includes(normalize(role.title))) || null;
}

// ── Page ─────────────────────────────────────────────────────────────
export default function ClassicDigitalOfficeContent() {
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [teamRoles, setTeamRoles] = useState<TeamRole[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [reason, setReason] = useState("");
  const [meta, setMeta] = useState<OfficeMeta>({});
  const [opBusyByMember, setOpBusyByMember] = useState<Record<string, string>>({});
  const [opError, setOpError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<PresenceTone | "all">("all");

  // ── Data fetching ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    const res = await fetch("/api/digital-office", { cache: "no-store" });
    const data = (await res.json()) as {
      members?: OfficeMember[];
      degraded?: boolean;
      reason?: string;
      meta?: OfficeMeta;
      structure?: { roles?: TeamRole[] };
    };

    const allMembers = Array.isArray(data.members) ? data.members : [];
    setMembers(allMembers);
    setTeamRoles(Array.isArray(data.structure?.roles) ? data.structure.roles : []);
    setDegraded(Boolean(data.degraded));
    setReason(data.reason || "");
    setMeta(data.meta || {});
  }, []);

  const { isLoading, isRefreshing, lastUpdated, isVisible, refreshNow } = useVisibilityPolling(load, {
    intervalMs: 15000,
  });

  // ── Member view (computed) ─────────────────────────────────────────
  const memberView = useMemo<OfficeMemberView[]>(() => {
    return members.map((member) => {
      const tone = inferTone(member.status);
      const matchedRole = findRole(member, teamRoles);
      return {
        ...member,
        teamRoleId: matchedRole?.id || null,
        teamRoleTitle: matchedRole?.title || null,
        presenceTone: tone,
        presenceLabel: toneLabel(tone),
        deskLabel: member.workstation || "General workstation",
      };
    });
  }, [members, teamRoles]);

  // ── Hierarchy data for the tree ─────────────────────────────────────
  const hierarchyRoles = useMemo<HierarchyRole[]>(() => {
    return teamRoles
      .filter((r) => r.ownerType && r.focus)
      .map((r) => ({
        id: r.id,
        title: r.title,
        ownerType: r.ownerType as "me" | "worker",
        focus: r.focus as string,
        parentId: r.parentId,
        subAgents: r.subAgents,
      }));
  }, [teamRoles]);

  const liveRoleIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const m of memberView) {
      if (m.presenceTone !== "idle" && m.presenceTone !== "offline") {
        // Try to match member to a team role
        if (m.teamRoleId) ids.add(m.teamRoleId);
      }
    }
    // Orchestrator is always live if any main session exists
    if (members.some((m) => m.live?.isMain)) {
      ids.add("orchestrator");
    }
    return ids;
  }, [memberView, members]);

  // ── Sort members so subagents appear directly after their parent ──
  const sortedMemberView = useMemo(() => {
    const parentSessionIdMap = new Map<string, OfficeMemberView[]>();
    const topLevel: OfficeMemberView[] = [];

    for (const m of memberView) {
      const pid = m.live?.parentSessionId;
      if (pid) {
        if (!parentSessionIdMap.has(pid)) parentSessionIdMap.set(pid, []);
        parentSessionIdMap.get(pid)!.push(m);
      } else {
        topLevel.push(m);
      }
    }

    const result: OfficeMemberView[] = [];
    for (const m of topLevel) {
      result.push(m);
      const sid = m.live?.sessionId;
      if (sid && parentSessionIdMap.has(sid)) {
        result.push(...parentSessionIdMap.get(sid)!);
      }
    }
    // Append any subagents whose parent wasn't found in topLevel
    for (const [, children] of parentSessionIdMap) {
      for (const child of children) {
        if (!result.includes(child)) result.push(child);
      }
    }
    return result;
  }, [memberView]);

  // ── Filtered member view ───────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    if (activeFilter === "all") return sortedMemberView;
    return sortedMemberView.filter((m) => m.presenceTone === activeFilter);
  }, [sortedMemberView, activeFilter]);

  // ── Counts ────────────────────────────────────────────────────────
  const activeCount = memberView.filter((m) => m.presenceTone === "working").length;
  const focusCount = memberView.filter((m) => m.presenceTone === "focus").length;
  const idleCount = memberView.filter((m) => m.presenceTone === "idle").length;
  const queuedCount = memberView.filter((m) => m.presenceTone === "queued").length;

  const selectableWorkerIds = useMemo(
    () =>
      memberView
        .filter((m) => m.source === "live" && m.role === "Worker Session" && m.ops.canStop)
        .map((m) => m.id),
    [memberView],
  );

  const selectedList = useMemo(
    () => selectableWorkerIds.filter((id) => selectedIds[id]),
    [selectableWorkerIds, selectedIds],
  );

  // ── Ops: refresh ──────────────────────────────────────────────────
  const runRefresh = useCallback(
    async (memberId?: string) => {
      setOpError("");
      const key = memberId || "all";
      setOpBusyByMember((prev) => ({ ...prev, [key]: "refresh" }));
      try {
        const res = await fetch("/api/digital-office/ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refresh" }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          snapshot?: { members?: OfficeMember[]; degraded?: boolean; reason?: string; meta?: OfficeMeta };
        };
        if (!res.ok || !data.ok || !data.snapshot) throw new Error("refresh failed");
        setMembers(Array.isArray(data.snapshot.members) ? data.snapshot.members : []);
        setDegraded(Boolean(data.snapshot.degraded));
        setReason(data.snapshot.reason || "");
        setMeta(data.snapshot.meta || {});
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to refresh";
        setOpError(msg);
        await refreshNow();
      } finally {
        setOpBusyByMember((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [refreshNow],
  );

  // ── Ops: stop worker ──────────────────────────────────────────────
  const runStopWorker = useCallback(async (memberId: string) => {
    setOpError("");
    setOpBusyByMember((prev) => ({ ...prev, [memberId]: "stop" }));
    try {
      const res = await fetch("/api/digital-office/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", memberId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        snapshot?: { members?: OfficeMember[]; degraded?: boolean; reason?: string; meta?: OfficeMeta };
      };
      if (!res.ok || !data.ok || !data.snapshot) throw new Error(data.error || "stop action failed");
      setMembers(Array.isArray(data.snapshot.members) ? data.snapshot.members : []);
      setDegraded(Boolean(data.snapshot.degraded));
      setReason(data.snapshot.reason || "");
      setMeta(data.snapshot.meta || {});
      setBulkSummary(null);
      setBulkResults([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to stop worker";
      setOpError(msg);
    } finally {
      setOpBusyByMember((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    }
  }, []);

  // ── Ops: bulk stop ────────────────────────────────────────────────
  const runBulkStop = useCallback(
    async (dryRun: boolean) => {
      if (selectedList.length === 0) return;
      setBulkBusy(true);
      setOpError("");
      try {
        const res = await fetch("/api/digital-office/ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop-bulk", memberIds: selectedList, dryRun }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          summary?: BulkSummary;
          results?: BulkResult[];
          snapshot?: { members?: OfficeMember[]; degraded?: boolean; reason?: string; meta?: OfficeMeta };
        };
        if (!res.ok || !data.ok || !data.summary || !Array.isArray(data.results) || !data.snapshot) {
          throw new Error(data.error || "bulk stop failed");
        }
        setBulkSummary(data.summary);
        setBulkResults(data.results);
        setMembers(Array.isArray(data.snapshot.members) ? data.snapshot.members : []);
        setDegraded(Boolean(data.snapshot.degraded));
        setReason(data.snapshot.reason || "");
        setMeta(data.snapshot.meta || {});
        if (!dryRun) setSelectedIds({});
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed bulk stop";
        setOpError(msg);
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedList],
  );

  const handleSelectAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const id of selectableWorkerIds) next[id] = true;
    setSelectedIds(next);
  }, [selectableWorkerIds]);

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  // Pixelated view is now the PRIMARY default view; list view is secondary
  const [pixelView, setPixelView] = useState(true);

  const pixelMembers = useMemo(() => members, [members]);

  if (pixelView) {
    return (
    <div style={{ position: 'relative', zIndex: 10, isolation: 'isolate' }}>
      <GalaxyRoom
        members={pixelMembers}
        degraded={degraded}
        meta={meta as { fetchedAt?: string }}
        pollIntervalMs={3000}
        onListViewToggle={() => setPixelView(false)}
      />
    </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* ── View toggle (back to pixel primary) ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setPixelView(true)}
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: "10px",
            padding: "6px 12px",
            background: "transparent",
            border: "2px solid #00FF9F",
            color: "#00FF9F",
            cursor: "pointer",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          🎮 Pixel View
        </button>
      </div>

      {/* ── Stats / Filter bar (with skeleton on first load) ── */}
      {isLoading && members.length === 0 ? (
        <StatsBarSkeleton />
      ) : (
        <OfficeStatsBar
          totalCount={memberView.length}
          activeCount={activeCount}
          focusCount={focusCount}
          idleCount={idleCount}
          queuedCount={queuedCount}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          isVisible={isVisible}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          selectedCount={selectedList.length}
          selectableCount={selectableWorkerIds.length}
          bulkBusy={bulkBusy}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedIds({})}
          onBulkDryRun={() => void runBulkStop(true)}
          onBulkStop={() => void runBulkStop(false)}
          onRefresh={() => void runRefresh()}
          refreshBusy={Boolean(opBusyByMember.all)}
        />
      )}

      {/* ── Error / status messages ── */}
      {degraded && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,176,174,0.08)", border: "1px solid rgba(255,176,174,0.3)", color: "#ffb0ae" }}>
          ⚠ Degraded mode: {reason || "metadata unavailable"}. Showing fallback roster.{" "}
          <span className="opacity-70">
            sessions=[{(meta.sessionMethodsTried || []).join(", ") || "—"}] subagents=[{(meta.subagentMethodsTried || []).join(", ") || "—"}]
          </span>
        </p>
      )}

      {!degraded && (meta.methodErrors || []).length > 0 && (
        <p className="text-xs" style={{ color: "#475569" }}>
          Partial live mode: some RPC methods failed ({(meta.methodErrors || []).slice(0, 2).join(" | ")}).
        </p>
      )}

      {opError && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,176,174,0.08)", border: "1px solid rgba(255,176,174,0.3)", color: "#ffb0ae" }}>
          Operator action failed: {opError}
        </p>
      )}

      {/* ── Bulk result summary ── */}
      {bulkSummary && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(9,132,227,0.06)", border: "1px solid rgba(0,212,255,0.15)", color: "#475569" }}
        >
          <span className="font-semibold">Bulk {bulkSummary.dryRun ? "preview" : "execute"}:</span>{" "}
          requested {bulkSummary.requested} · allowed {bulkSummary.allowed} · blocked {bulkSummary.blocked}
          {bulkSummary.dryRun
            ? " · (no sessions stopped)"
            : ` · stopped ${bulkSummary.stopped} · failed ${bulkSummary.failed}`}
        </div>
      )}

      {bulkResults.length > 0 && (
        <div
          className="rounded-lg px-3 py-2 flex flex-col gap-1"
          style={{ background: "rgba(8,12,30,0.55)", border: "1px solid rgba(0,212,255,0.12)" }}
        >
          {bulkResults.slice(0, 8).map((item) => (
            <p key={item.memberId} className="text-xs" style={{ color: "#475569" }}>
              {item.memberId}:{" "}
              {item.allowed
                ? item.stopped === true
                  ? `stopped via ${item.usedMethod || "—"}`
                  : item.stopped === false
                    ? `failed (${(item.errors || ["unknown"])[0]})`
                    : "allowed"
                : `blocked (${item.reason || "guardrail"})`}
            </p>
          ))}
        </div>
      )}

      {/* ── Hierarchy tree (above grid) ── */}
      {hierarchyRoles.length > 0 && (
        <HierarchyTree roles={hierarchyRoles} liveRoleIds={liveRoleIds} />
      )}

      {/* ── Agent grid ── */}
      {isLoading && members.length === 0 ? (
        <AgentGridSkeleton count={6} />
      ) : !isLoading && filteredMembers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
          style={{
            background: "rgba(8,12,30,0.45)",
            border: "1px solid rgba(0,212,255,0.12)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          <span className="text-3xl" aria-hidden="true">🪑</span>
          <p className="text-sm font-medium" style={{ color: "#475569" }}>
            {activeFilter === "all"
              ? "No agents at their desks right now"
              : `No agents with status "${activeFilter}" right now`}
          </p>
          <p className="text-xs" style={{ color: "#5e7299" }}>
            The office will update automatically every 15 seconds.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="list"
          aria-label="Digital office workstation cards"
        >
          {filteredMembers.map((member) => (
            <AgentDeskCard
              key={member.id}
              id={member.id}
              name={member.name}
              role={member.role}
              workstation={member.workstation}
              source={member.source}
              status={member.status}
              statusDetail={member.statusDetail}
              details={member.details}
              live={member.live}
              ops={member.ops}
              presenceTone={member.presenceTone}
              presenceLabel={member.presenceLabel}
              deskLabel={member.deskLabel}
              teamRoleTitle={member.teamRoleTitle}
              runningFrom={member.runningFrom}
              isSelected={Boolean(selectedIds[member.id])}
              onToggleSelect={handleToggleSelect}
              onRefresh={(id) => void runRefresh(id)}
              onStop={(id) => void runStopWorker(id)}
              isBusy={opBusyByMember[member.id]}
              bulkBusy={bulkBusy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
