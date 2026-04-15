"use client";

import { useCallback, useState } from "react";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";

// ── Types ─────────────────────────────────────────────────────────
type AgentStatus = "active" | "idle" | "error";

type BaseAgent = {
  id: string; name: string; emoji: string; model: string;
  status: AgentStatus; lastActivity: string | null;
};
type OrchestratorAgent = BaseAgent & {
  contextPct: number; sessionId: string | null;
};
type ContentAgent = BaseAgent & {
  episodeCount: number; postedCount: number;
};
type ClipAgent = BaseAgent & {
  clipsTotal: number; clipsReady: number;
};
type TradingAgent = BaseAgent & {
  boxDate: string | null; currentZone: string | null;
  currentPrice: number | null; tradesCount: number; closedTrades: number;
  totalPnlUsd: number;
};
type CommunityAgent = BaseAgent;

type ActiveSession = {
  id: string; label: string; rawKey: string; agentId: string;
  model: string; state: string; isMain: boolean;
  updatedAt: string | null; contextPct: number | null;
};

type OverviewData = {
  fetchedAt: string;
  agents: {
    alpha: OrchestratorAgent;
    beta: ContentAgent;
    gamma: ClipAgent;
    delta: TradingAgent;
    community: CommunityAgent;
  };
  activeSessions: ActiveSession[];
};

// ── Colors ────────────────────────────────────────────────────────
const C = {
  bg: "#1A1A2E",
  card: "#1E1E34",
  border: "rgba(37,37,64,0.8)",
  green: "#00FF9F",
  text: "#c8deff",
  muted: "#8da3cb",
  dim: "#5e7299",
  red: "#ffb0ae",
  yellow: "#fbbf24",
} as const;

function statusColor(status: AgentStatus): string {
  if (status === "active") return C.green;
  if (status === "error") return C.red;
  return C.yellow;
}

function statusLabel(status: AgentStatus): string {
  if (status === "active") return "● Active";
  if (status === "error") return "● Error";
  return "○ Idle";
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function deriveSessionName(label: string, rawKey: string): string {
  if (label && label.length > 3 && !label.match(/^[0-9a-f-]{36}$/)) return label;
  const parts = rawKey.split(":");
  if (parts.length > 3) return parts.slice(2).join(":").slice(0, 40);
  return label || rawKey.slice(0, 20);
}

function deriveAgentFromSession(s: ActiveSession): string {
  const rawKey = s.rawKey.toLowerCase();
  if (rawKey.startsWith("agent:beta:")) return "beta";
  if (rawKey.startsWith("agent:gamma:")) return "gamma";
  if (rawKey.startsWith("agent:community:")) return "community";
  if (s.agentId && s.agentId !== "main") return s.agentId;
  return s.isMain ? "main" : "subagent";
}

// ── Agent Card ────────────────────────────────────────────────────
function AgentCard({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${active ? "rgba(0,255,159,0.25)" : C.border}`,
        borderRadius: 12,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function ModelBadge({ model }: { model: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 99,
        background: "rgba(0,255,159,0.08)",
        border: "1px solid rgba(0,255,159,0.2)",
        color: C.green,
        fontFamily: "Courier New, monospace",
        letterSpacing: "0.3px",
      }}
    >
      {model}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: C.dim }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontFamily: "Courier New, monospace" }}>
        {value}
      </span>
    </div>
  );
}

function ContextBar({ pct }: { pct: number }) {
  const color = pct > 80 ? C.red : pct > 60 ? C.yellow : C.green;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: C.dim }}>Context</span>
        <span style={{ fontSize: 10, color, fontFamily: "Courier New, monospace" }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div
          suppressHydrationWarning
          style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 2, transition: "width 0.3s ease" }}
        />
      </div>
    </div>
  );
}

// ── Session Row ───────────────────────────────────────────────────
function SessionRow({ s }: { s: ActiveSession }) {
  const agentId = deriveAgentFromSession(s);
  const name = deriveSessionName(s.label, s.rawKey);
  const stateColor =
    s.state.includes("run") || s.state.includes("work") || s.state.includes("active")
      ? C.green
      : C.muted;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto auto",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 12,
      }}
    >
      <span style={{ color: C.text, fontFamily: "Courier New, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>
        {name}
      </span>
      <span style={{ color: C.dim, fontSize: 11, textAlign: "right" }}>{agentId}</span>
      <span style={{ color: C.muted, fontSize: 10, fontFamily: "Courier New, monospace", textAlign: "right" }}>{s.model.replace("anthropic/", "")}</span>
      <span style={{ color: stateColor, fontSize: 11, textAlign: "right" }}>{s.state}</span>
      <span style={{ color: C.dim, fontSize: 10, textAlign: "right", whiteSpace: "nowrap" }}>
        {fmtRelative(s.updatedAt)}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function AgentOverviewContent() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-overview", { cache: "no-store" });
      const json = (await res.json()) as OverviewData;
      setData(json);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const { isLoading, isRefreshing, lastUpdated } = useVisibilityPolling(load, {
    intervalMs: 15000,
  });

  if (isLoading && !data) {
    return (
      <div style={{ padding: "2rem", color: C.dim, fontFamily: "Courier New, monospace", fontSize: 13 }}>
        Loading agent overview…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", color: C.red, fontFamily: "Courier New, monospace", fontSize: 12 }}>
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const { agents, activeSessions } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
            Agent Fleet
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: "Courier New, monospace", margin: 0 }}>
            REGISTERED AGENTS
          </h2>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace" }}>
          {isRefreshing ? "Refreshing…" : lastUpdated ? `Updated ${fmtRelative(lastUpdated)}` : ""}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>

        {/* Agent Alpha (Orchestrator) */}
        <AgentCard active={agents.alpha.status === "active"}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agents.alpha.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agents.alpha.name}</div>
              <ModelBadge model={agents.alpha.model} />
            </div>
            <span style={{ fontSize: 11, color: statusColor(agents.alpha.status), fontFamily: "Courier New, monospace" }}>
              {statusLabel(agents.alpha.status)}
            </span>
          </div>
          <ContextBar pct={agents.alpha.contextPct} />
          <Metric label="Last active" value={fmtRelative(agents.alpha.lastActivity)} />
          {agents.alpha.sessionId && (
            <Metric label="Session" value={agents.alpha.sessionId.slice(0, 8) + "…"} />
          )}
        </AgentCard>

        {/* Agent Beta (Content) */}
        <AgentCard active={agents.beta.status === "active"}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agents.beta.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agents.beta.name}</div>
              <ModelBadge model={agents.beta.model} />
            </div>
            <span style={{ fontSize: 11, color: statusColor(agents.beta.status), fontFamily: "Courier New, monospace" }}>
              {statusLabel(agents.beta.status)}
            </span>
          </div>
          <Metric label="Episodes" value={agents.beta.episodeCount} />
          <Metric label="With video" value={agents.beta.postedCount} />
          <Metric label="Last active" value={fmtRelative(agents.beta.lastActivity)} />
        </AgentCard>

        {/* Agent Gamma (Clips) */}
        <AgentCard active={agents.gamma.status === "active"}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agents.gamma.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agents.gamma.name}</div>
              <ModelBadge model={agents.gamma.model} />
            </div>
            <span style={{ fontSize: 11, color: statusColor(agents.gamma.status), fontFamily: "Courier New, monospace" }}>
              {statusLabel(agents.gamma.status)}
            </span>
          </div>
          <Metric label="Clips total" value={agents.gamma.clipsTotal} />
          <Metric label="Ready to post" value={agents.gamma.clipsReady} />
          <Metric label="Last active" value={fmtRelative(agents.gamma.lastActivity)} />
        </AgentCard>

        {/* Agent Delta (Trading) */}
        <AgentCard active={false}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agents.delta.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agents.delta.name}</div>
              <ModelBadge model={agents.delta.model} />
            </div>
            <span style={{ fontSize: 11, color: C.yellow, fontFamily: "Courier New, monospace" }}>
              ⏰ Cron
            </span>
          </div>
          {agents.delta.boxDate && (
            <Metric label="Box date" value={agents.delta.boxDate} />
          )}
          {agents.delta.currentZone && (
            <Metric label="Zone" value={agents.delta.currentZone} />
          )}
          <Metric label="Trades" value={`${agents.delta.closedTrades} closed`} />
          <Metric
            label="PnL (paper)"
            value={`$${agents.delta.totalPnlUsd >= 0 ? "+" : ""}${agents.delta.totalPnlUsd}`}
          />
        </AgentCard>

        {/* Community */}
        <AgentCard active={agents.community.status === "active"}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agents.community.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{agents.community.name}</div>
              <ModelBadge model={agents.community.model} />
            </div>
            <span style={{ fontSize: 11, color: statusColor(agents.community.status), fontFamily: "Courier New, monospace" }}>
              {statusLabel(agents.community.status)}
            </span>
          </div>
          <Metric label="Channel" value="OpenClaw TG group" />
          <Metric label="Last active" value={fmtRelative(agents.community.lastActivity)} />
        </AgentCard>
      </div>

      {/* Live Sessions Section */}
      {activeSessions.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", letterSpacing: "1.5px", textTransform: "uppercase", margin: 0 }}>
              Live Sessions
            </p>
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 99,
              background: "rgba(0,255,159,0.1)", border: "1px solid rgba(0,255,159,0.3)", color: C.green,
            }}>
              {activeSessions.length}
            </span>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto auto",
              gap: 8,
              padding: "6px 12px",
              background: "rgba(37,37,64,0.5)",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 10,
              color: C.dim,
              fontFamily: "Courier New, monospace",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}>
              <span>Session</span>
              <span style={{ textAlign: "right" }}>Agent</span>
              <span style={{ textAlign: "right" }}>Model</span>
              <span style={{ textAlign: "right" }}>State</span>
              <span style={{ textAlign: "right" }}>Updated</span>
            </div>
            {activeSessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      {activeSessions.length === 0 && !isLoading && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "24px", textAlign: "center", color: C.dim, fontSize: 13,
          fontFamily: "Courier New, monospace",
        }}>
          🌙 No active sessions right now
        </div>
      )}
    </div>
  );
}
