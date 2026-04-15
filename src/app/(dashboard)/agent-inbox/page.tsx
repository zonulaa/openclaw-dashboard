"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";

// ── Types ─────────────────────────────────────────────────────────
type QaState = "running" | "submitted" | "in_review" | "revision_requested" | "approved" | "blocked_waiting_User" | "failed" | "idle";

type InboxSession = {
  key: string;
  agentId: string;
  bucket: "main" | "subagent" | "system" | "extra";
  label: string;
  sourceType: "main" | "subagent" | "cron" | "acp" | "telegram" | "manual" | "internal_dev";
  qaState: QaState;
  model: string;
  updatedAt: number;
  startedAt: number;
  messageCount: number;
  taskSummary: string;
  who: string;
  sessionFile: string;
  spawnedBy: string | null;
  groupChannel: string | null;
  transcriptPath?: string | null;
  logPath?: string | null;
  cwd?: string | null;
  harness?: string | null;
};

type AgentData = {
  label: string;
  emoji: string;
  sessions: InboxSession[];
};

type InboxData = {
  ok: boolean;
  agents: Record<string, AgentData>;
  dailyMeeting: Record<string, InboxSession[]>;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "toolResult" | "toolCall" | "unknown";
  content: string;
  timestamp: string | null;
  toolName?: string;
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
  orange: "#fb923c",
  blue: "#60a5fa",
  purple: "#a78bfa",
} as const;

const FONT = "Courier New, monospace";

// ── Utilities ─────────────────────────────────────────────────────

function fmtRelative(ts: number): string {
  if (!ts) return "\u2014";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function fmtDate(ts: number): string {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function modelShort(model: string): string {
  if (!model || model === "unknown") return "\u2014";
  return model
    .replace("anthropic/", "")
    .replace("claude-", "cl-")
    .replace("sonnet-4-6", "s4.6")
    .replace("haiku-4-5", "h4.5")
    .replace("opus-4", "o4")
    .slice(0, 16);
}

// ── QA State badges ───────────────────────────────────────────────

const QA_CONFIG: Record<QaState, { label: string; color: string; bg: string }> = {
  running:                 { label: "Running",           color: C.green,  bg: "rgba(0,255,159,0.12)" },
  submitted:               { label: "Submitted",         color: C.blue,   bg: "rgba(96,165,250,0.12)" },
  in_review:               { label: "In Review",         color: C.yellow, bg: "rgba(251,191,36,0.12)" },
  revision_requested:      { label: "Revision Req.",     color: C.orange, bg: "rgba(251,146,60,0.12)" },
  approved:                { label: "Approved",          color: C.green,  bg: "rgba(0,255,159,0.15)" },
  blocked_waiting_User:  { label: "Needs User",      color: C.red,    bg: "rgba(255,176,174,0.12)" },
  failed:                  { label: "Failed",            color: C.red,    bg: "rgba(255,176,174,0.12)" },
  idle:                    { label: "Idle",              color: C.dim,    bg: "rgba(94,114,153,0.12)" },
};

function QaBadge({ state }: { state: QaState }) {
  const cfg = QA_CONFIG[state];
  return (
    <span style={{
      fontSize: 9, padding: "2px 7px", borderRadius: 99,
      background: cfg.bg, border: `1px solid ${cfg.color}33`,
      color: cfg.color, fontFamily: FONT, letterSpacing: "0.3px",
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function SourceBadge({ type }: { type: InboxSession["sourceType"] }) {
  const labels: Record<string, { text: string; color: string }> = {
    main: { text: "main", color: C.green },
    subagent: { text: "subagent", color: C.purple },
    cron: { text: "cron", color: C.yellow },
    acp: { text: "ACP", color: C.blue },
    telegram: { text: "telegram", color: C.muted },
    manual: { text: "manual", color: C.dim },
    internal_dev: { text: "internal dev", color: C.purple },
  };
  const l = labels[type] ?? labels.manual;
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 4,
      background: `${l.color}15`, color: l.color,
      fontFamily: FONT, letterSpacing: "0.3px",
    }}>
      {l.text}
    </span>
  );
}

function ModelBadge({ model }: { model: string }) {
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 4,
      background: "rgba(0,255,159,0.06)", border: "1px solid rgba(0,255,159,0.15)",
      color: C.green, fontFamily: FONT, letterSpacing: "0.3px",
    }}>
      {modelShort(model)}
    </span>
  );
}

// ── Inline chat viewer ────────────────────────────────────────────

function roleBubbleStyle(role: ChatMessage["role"]): React.CSSProperties {
  if (role === "assistant") return {
    alignSelf: "flex-start", background: "rgba(0,255,159,0.07)",
    border: "1px solid rgba(0,255,159,0.2)", borderRadius: "4px 12px 12px 12px", maxWidth: "85%",
  };
  if (role === "user") return {
    alignSelf: "flex-end", background: "rgba(200,222,255,0.07)",
    border: "1px solid rgba(200,222,255,0.15)", borderRadius: "12px 4px 12px 12px", maxWidth: "85%",
  };
  if (role === "toolCall" || role === "toolResult") return {
    alignSelf: "flex-start", background: "rgba(251,191,36,0.05)",
    border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", maxWidth: "90%",
  };
  return { alignSelf: "flex-start", background: "rgba(0,212,255,0.09)", borderRadius: "8px", maxWidth: "85%" };
}

function roleLabel(role: ChatMessage["role"]): string {
  if (role === "assistant") return "Agent";
  if (role === "user") return "User";
  if (role === "toolCall") return "Tool call";
  if (role === "toolResult") return "Tool result";
  return role;
}

function roleLabelColor(role: ChatMessage["role"]): string {
  if (role === "assistant") return C.green;
  if (role === "user") return C.text;
  if (role === "toolCall" || role === "toolResult") return C.yellow;
  return C.muted;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", ...roleBubbleStyle(msg.role) }}>
      <div style={{ padding: "8px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: roleLabelColor(msg.role), fontFamily: FONT }}>
            {roleLabel(msg.role)}
            {msg.toolName && <span style={{ marginLeft: 6, color: C.yellow, fontWeight: 400 }}>{msg.toolName}</span>}
          </span>
          {ts && <span style={{ fontSize: 9, color: C.dim, fontFamily: FONT }}>{ts}</span>}
        </div>
        <p style={{
          margin: 0, fontSize: 12, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap",
          color: msg.role === "toolCall" || msg.role === "toolResult" ? C.muted : C.text,
          fontFamily: msg.role === "toolCall" || msg.role === "toolResult" ? FONT : "inherit",
        }}>
          {msg.content}
        </p>
      </div>
    </div>
  );
}

function SessionTranscript({ sessionFile }: { sessionFile: string }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agent-inbox?sessionFile=${encodeURIComponent(sessionFile)}`, { cache: "no-store" })
      .then(r => r.json())
      .then((data: { ok: boolean; messages: ChatMessage[] }) => {
        setMessages(data.ok ? data.messages : []);
        setLoading(false);
      })
      .catch(() => { setMessages([]); setLoading(false); });
  }, [sessionFile]);

  if (loading) return <div style={{ padding: 16, color: C.dim, fontSize: 12, fontFamily: FONT }}>Loading messages...</div>;
  if (!messages || messages.length === 0) return <div style={{ padding: 16, color: C.dim, fontSize: 12, fontFamily: FONT }}>No messages found</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, maxHeight: 500, overflowY: "auto" }}>
      {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────

function SessionCard({ session, compact }: { session: InboxSession; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${session.qaState === "running" ? "rgba(0,255,159,0.25)" : session.qaState === "failed" ? "rgba(255,176,174,0.25)" : C.border}`,
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.15s ease",
    }}>
      {/* Header row — clickable */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr auto auto auto" : "1fr auto auto auto auto auto",
          gap: 8,
          alignItems: "center",
          padding: "10px 14px",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: C.text,
        }}
      >
        {/* Label + summary */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: C.text, fontFamily: FONT,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {expanded ? "\u25BC" : "\u25B6"}{" "}
            {session.label}
          </div>
          {session.taskSummary && (
            <div style={{
              fontSize: 10, color: C.dim, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {session.taskSummary}
            </div>
          )}
        </div>

        {/* Who */}
        {!compact && (
          <span style={{ fontSize: 10, color: C.muted, fontFamily: FONT, whiteSpace: "nowrap" }}>
            {session.who}
          </span>
        )}

        {/* Source + Model */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <SourceBadge type={session.sourceType} />
          <ModelBadge model={session.model} />
        </div>

        {/* QA State */}
        <QaBadge state={session.qaState} />

        {/* Messages count */}
        <span style={{ fontSize: 10, color: C.dim, fontFamily: FONT, whiteSpace: "nowrap" }}>
          {session.messageCount} msg
        </span>

        {/* Time */}
        <span style={{ fontSize: 10, color: C.dim, fontFamily: FONT, whiteSpace: "nowrap" }}>
          {fmtRelative(session.updatedAt)}
        </span>
      </button>

      {/* Expanded: transcript */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
            padding: "10px 14px",
            borderBottom: `1px solid ${C.border}`,
            background: "rgba(10,14,28,0.18)",
            fontFamily: FONT,
            fontSize: 10,
            color: C.muted,
          }}>
            <span>Started: <span style={{ color: C.text }}>{fmtDate(session.startedAt)}</span></span>
            <span>Updated: <span style={{ color: C.text }}>{fmtDate(session.updatedAt)}</span></span>
            {session.cwd && <span>CWD: <span style={{ color: C.text }}>{session.cwd}</span></span>}
            {session.harness && <span>Harness: <span style={{ color: C.text }}>{session.harness}</span></span>}
            {session.transcriptPath && <span>Transcript: <span style={{ color: C.text }}>{session.transcriptPath}</span></span>}
            {session.logPath && <span>Log: <span style={{ color: C.text }}>{session.logPath}</span></span>}
          </div>
          {session.sessionFile ? (
            <SessionTranscript sessionFile={session.sessionFile} />
          ) : (
            <div style={{ padding: 16, color: C.dim, fontSize: 12, fontFamily: FONT }}>No transcript attached</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bucket section ────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, { label: string; desc: string }> = {
  main: { label: "Main Reports", desc: "Real work reports ready for QA review" },
  subagent: { label: "Subagent Work", desc: "Delegated tasks to child agents" },
  system: { label: "Cron & System", desc: "Heartbeat, cron, and ops threads. Hidden by default." },
  extra: { label: "DMs & Other", desc: "Direct messages, slash commands — not part of agent workflow" },
};

function BucketSection({ bucket, sessions, defaultCollapsed }: {
  bucket: string;
  sessions: InboxSession[];
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const cfg = BUCKET_LABELS[bucket] ?? { label: bucket, desc: "" };
  const activeCount = sessions.filter(s => s.qaState === "running" || s.qaState === "submitted" || s.qaState === "failed").length;

  return (
    <div>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 0", marginBottom: collapsed ? 0 : 8,
          color: C.text, width: "100%", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 10, color: C.dim }}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: FONT, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          {cfg.label}
        </span>
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 99,
          background: activeCount > 0 ? "rgba(0,255,159,0.1)" : "rgba(94,114,153,0.15)",
          color: activeCount > 0 ? C.green : C.dim, fontFamily: FONT,
        }}>
          {sessions.length}
        </span>
        <span style={{ fontSize: 10, color: C.dim, flex: 1 }}>{cfg.desc}</span>
      </button>
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 8 }}>
          {sessions.map(s => <SessionCard key={s.key} session={s} />)}
        </div>
      )}
    </div>
  );
}

// ── Agent tab view ────────────────────────────────────────────────

function AgentView({ agent }: { agent: AgentData }) {
  const [showHistory, setShowHistory] = useState(false);

  // Split active vs finished
  const activeSessions = agent.sessions.filter(s =>
    s.qaState === "running" || s.qaState === "submitted" || s.qaState === "failed" || s.qaState === "in_review" || s.qaState === "revision_requested" || s.qaState === "blocked_waiting_User"
  );
  const historySessions = agent.sessions.filter(s =>
    s.qaState === "approved" || s.qaState === "idle"
  );

  // Group active by bucket
  const activeBuckets: Record<string, InboxSession[]> = { main: [], subagent: [], system: [], extra: [] };
  for (const s of activeSessions) {
    (activeBuckets[s.bucket] ??= []).push(s);
  }
  const historyBuckets: Record<string, InboxSession[]> = { main: [], subagent: [], system: [], extra: [] };
  for (const s of historySessions) {
    (historyBuckets[s.bucket] ??= []).push(s);
  }

  const totalActive = activeSessions.length;
  const totalHistory = historySessions.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 16, fontSize: 10, color: C.dim, fontFamily: FONT,
        padding: "6px 0", borderBottom: `1px solid ${C.border}`,
      }}>
        <span><span style={{ color: C.text, fontWeight: 700 }}>{agent.sessions.length}</span> total sessions</span>
        <span><span style={{ color: C.green }}>{totalActive}</span> active</span>
        <span><span style={{ color: C.dim }}>{totalHistory}</span> history</span>
      </div>

      {/* Active buckets */}
      {totalActive === 0 ? (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 24, textAlign: "center", color: C.dim, fontSize: 13, fontFamily: FONT,
        }}>
          No active sessions right now
        </div>
      ) : (
        <>
          {activeBuckets.main.length > 0 && (
            <BucketSection bucket="main" sessions={activeBuckets.main} />
          )}
          {activeBuckets.subagent.length > 0 && (
            <BucketSection bucket="subagent" sessions={activeBuckets.subagent} />
          )}
          {activeBuckets.system.length > 0 && (
            <BucketSection bucket="system" sessions={activeBuckets.system} defaultCollapsed />
          )}
          {activeBuckets.extra.length > 0 && (
            <BucketSection bucket="extra" sessions={activeBuckets.extra} defaultCollapsed />
          )}
        </>
      )}

      {/* History toggle */}
      {totalHistory > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{
              background: showHistory ? "rgba(0,255,159,0.08)" : "rgba(0,212,255,0.09)",
              border: `1px solid ${showHistory ? "rgba(0,255,159,0.2)" : C.border}`,
              color: showHistory ? C.green : C.muted,
              padding: "6px 14px", borderRadius: 6, cursor: "pointer",
              fontFamily: FONT, fontSize: 11, fontWeight: showHistory ? 700 : 400,
            }}
          >
            {showHistory ? "Hide history" : `Show history (${totalHistory})`}
          </button>

          {showHistory && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {historyBuckets.main.length > 0 && (
                <BucketSection bucket="main" sessions={historyBuckets.main} defaultCollapsed />
              )}
              {historyBuckets.subagent.length > 0 && (
                <BucketSection bucket="subagent" sessions={historyBuckets.subagent} defaultCollapsed />
              )}
              {historyBuckets.system.length > 0 && (
                <BucketSection bucket="system" sessions={historyBuckets.system} defaultCollapsed />
              )}
              {historyBuckets.extra.length > 0 && (
                <BucketSection bucket="extra" sessions={historyBuckets.extra} defaultCollapsed />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Daily Meeting view ────────────────────────────────────────────

function DailyMeetingView({ dailyMeeting }: { dailyMeeting: Record<string, InboxSession[]> }) {
  const dateKeys = Object.keys(dailyMeeting).sort((a, b) => b.localeCompare(a));
  const [expandedDate, setExpandedDate] = useState<string | null>(dateKeys[0] ?? null);

  if (dateKeys.length === 0) {
    return (
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: 32, textAlign: "center", color: C.dim, fontSize: 13, fontFamily: FONT,
      }}>
        No daily activity to display
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        fontSize: 10, color: C.dim, fontFamily: FONT, padding: "4px 0",
        borderBottom: `1px solid ${C.border}`, letterSpacing: "0.5px",
      }}>
        Synthetic daily standup \u2014 all agent activity grouped by date
      </div>

      {dateKeys.slice(0, 14).map(dateKey => {
        const sessions = dailyMeeting[dateKey];
        const isExpanded = expandedDate === dateKey;

        // Group by agent for the standup summary
        const byAgent: Record<string, InboxSession[]> = {};
        for (const s of sessions) {
          (byAgent[s.agentId] ??= []).push(s);
        }

        const runningCount = sessions.filter(s => s.qaState === "running").length;
        const failedCount = sessions.filter(s => s.qaState === "failed").length;
        const submittedCount = sessions.filter(s => s.qaState === "submitted").length;

        return (
          <div key={dateKey} style={{
            background: C.card,
            border: `1px solid ${isExpanded ? "rgba(0,255,159,0.2)" : C.border}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* Date header */}
            <button
              onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", width: "100%",
                background: isExpanded ? "rgba(0,255,159,0.04)" : "none",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT }}>
                {isExpanded ? "\u25BC" : "\u25B6"} {fmtDateKey(dateKey)}
              </span>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: FONT }}>
                {sessions.length} sessions across {Object.keys(byAgent).length} agents
              </span>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {runningCount > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "rgba(0,255,159,0.1)", color: C.green, fontFamily: FONT }}>
                    {runningCount} running
                  </span>
                )}
                {submittedCount > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "rgba(96,165,250,0.1)", color: C.blue, fontFamily: FONT }}>
                    {submittedCount} submitted
                  </span>
                )}
                {failedCount > 0 && (
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "rgba(255,51,102,0.1)", color: C.red, fontFamily: FONT }}>
                    {failedCount} failed
                  </span>
                )}
              </div>
            </button>

            {/* Expanded: agent check-ins */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
                {Object.entries(byAgent).map(([agentId, agentSessions]) => {
                  const agentLabel = agentSessions[0]?.who?.split(" ")[0] ?? agentId;
                  return (
                    <div key={agentId} style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: C.green, fontFamily: FONT,
                        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8,
                        paddingBottom: 4, borderBottom: `1px solid ${C.border}`,
                      }}>
                        {agentLabel} \u2014 {agentSessions.length} session{agentSessions.length > 1 ? "s" : ""}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {agentSessions.map(s => (
                          <SessionCard key={s.key} session={s} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Top-level tabs ────────────────────────────────────────────────

type ViewMode = "agents" | "standup";

function AgentInboxInner() {
  const [data, setData] = useState<InboxData | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("agents");
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-inbox", { cache: "no-store" });
      const json = (await res.json()) as InboxData;
      if (json.ok) {
        setData(json);
        // Auto-select first agent if none selected
        if (!selectedAgent && json.agents) {
          const firstAgent = Object.keys(json.agents)[0];
          if (firstAgent) setSelectedAgent(firstAgent);
        }
        setError("");
      } else {
        setError(json.error ?? "Failed to load");
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const { isLoading, isRefreshing, lastUpdated } = useVisibilityPolling(load, { intervalMs: 30000 });

  if (isLoading && !data) {
    return (
      <div style={{ padding: "2rem", color: C.dim, fontFamily: FONT, fontSize: 13 }}>
        Loading agent inbox...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: "2rem", color: C.red, fontFamily: FONT, fontSize: 12 }}>
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const agentData = data.agents[selectedAgent];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "1.25rem" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, color: C.dim, fontFamily: FONT, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
            Multi-Agent Communications
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: FONT, margin: 0 }}>
            AGENT INBOX
          </h2>
          <p style={{ fontSize: 11, color: C.dim, margin: "4px 0 0" }}>
            QA workspace \u2014 inspect agent work, subagent threads, and daily coordination
          </p>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: FONT, textAlign: "right" }}>
          {isRefreshing ? "Refreshing\u2026" : lastUpdated ? `Updated ${fmtRelative(new Date(lastUpdated).getTime())}` : ""}
        </div>
      </div>

      {/* View mode toggle */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        <button
          onClick={() => setViewMode("agents")}
          style={{
            background: "none", border: "none",
            borderBottom: viewMode === "agents" ? `2px solid ${C.green}` : "2px solid transparent",
            color: viewMode === "agents" ? C.green : C.muted,
            padding: "8px 16px", cursor: "pointer", fontFamily: FONT, fontSize: 12,
            fontWeight: viewMode === "agents" ? 700 : 400, marginBottom: -1,
          }}
        >
          By Agent
        </button>
        <button
          onClick={() => setViewMode("standup")}
          style={{
            background: "none", border: "none",
            borderBottom: viewMode === "standup" ? `2px solid ${C.green}` : "2px solid transparent",
            color: viewMode === "standup" ? C.green : C.muted,
            padding: "8px 16px", cursor: "pointer", fontFamily: FONT, fontSize: 12,
            fontWeight: viewMode === "standup" ? 700 : 400, marginBottom: -1,
          }}
        >
          Daily Standup
        </button>
      </div>

      {/* Content */}
      {viewMode === "agents" ? (
        <>
          {/* Agent tabs (dynamically populated from gateway data) */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Object.entries(data.agents).map(([id, agent]) => {
              if (!agent) return null;
              const activeCount = agent.sessions.filter(s => (s.bucket === "main" || s.bucket === "subagent") && (s.qaState === "running" || s.qaState === "submitted" || s.qaState === "failed")).length;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedAgent(id)}
                  style={{
                    background: selectedAgent === id ? "rgba(0,255,159,0.08)" : "rgba(0,212,255,0.06)",
                    border: `1px solid ${selectedAgent === id ? "rgba(0,255,159,0.3)" : C.border}`,
                    color: selectedAgent === id ? C.green : C.muted,
                    padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                    fontFamily: FONT, fontSize: 12, fontWeight: selectedAgent === id ? 700 : 400,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span>{agent.emoji}</span>
                  <span>{agent.label}</span>
                  {activeCount > 0 && (
                    <span style={{
                      fontSize: 9, padding: "1px 5px", borderRadius: 99,
                      background: "rgba(0,255,159,0.15)", color: C.green,
                    }}>
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Agent content */}
          {agentData ? (
            <AgentView agent={agentData} />
          ) : (
            <div style={{ padding: 24, color: C.dim, fontFamily: FONT, fontSize: 12 }}>
              No data for this agent
            </div>
          )}
        </>
      ) : (
        <DailyMeetingView dailyMeeting={data.dailyMeeting} />
      )}
    </div>
  );
}

export default function AgentInboxPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#5e7299", fontFamily: FONT }}>Loading\u2026</div>}>
      <AgentInboxInner />
    </Suspense>
  );
}
