"use client";

import { useCallback, useEffect, useState } from "react";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";

// ── Types ─────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "toolResult" | "toolCall" | "unknown";
  content: string;
  timestamp: string | null;
  toolName?: string;
  sessionKey?: string;
};

type ChatData = {
  ok: boolean;
  agent: string;
  messages: ChatMessage[];
  totalParsed: number;
  sessionsMatched: number;
  totalSessions: number;
  sessionKeys?: string[];
  filesRead: string[];
  error?: string;
};

const AGENTS = [
  { id: "content", label: "🎬 Content", desc: "Content agent" },
  { id: "clips", label: "🤖 Clips", desc: "Clip agent" },
  { id: "community", label: "💬 Community", desc: "Community agent" },
  { id: "claude-code", label: "💻 Claude Code (ACP)", desc: "ACP sessions" },
];

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

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function roleBubbleStyle(role: ChatMessage["role"]): React.CSSProperties {
  if (role === "assistant") {
    return {
      alignSelf: "flex-start",
      background: "rgba(0,255,159,0.07)",
      border: "1px solid rgba(0,255,159,0.2)",
      borderRadius: "4px 12px 12px 12px",
      maxWidth: "85%",
    };
  }
  if (role === "user") {
    return {
      alignSelf: "flex-end",
      background: "rgba(200,222,255,0.07)",
      border: "1px solid rgba(200,222,255,0.15)",
      borderRadius: "12px 4px 12px 12px",
      maxWidth: "85%",
    };
  }
  if (role === "toolCall" || role === "toolResult") {
    return {
      alignSelf: "flex-start",
      background: "rgba(251,191,36,0.05)",
      border: "1px solid rgba(251,191,36,0.2)",
      borderRadius: "8px",
      maxWidth: "90%",
    };
  }
  return {
    alignSelf: "flex-start",
    background: "rgba(0,212,255,0.09)",
    borderRadius: "8px",
    maxWidth: "85%",
  };
}

function roleLabel(role: ChatMessage["role"]): string {
  if (role === "assistant") return "🤖 Agent";
  if (role === "user") return "👤 User";
  if (role === "toolCall") return "🔧 Tool call";
  if (role === "toolResult") return "📤 Tool result";
  return role;
}

function roleLabelColor(role: ChatMessage["role"]): string {
  if (role === "assistant") return C.green;
  if (role === "user") return C.text;
  if (role === "toolCall" || role === "toolResult") return C.yellow;
  return C.muted;
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, ...roleBubbleStyle(msg.role) }}>
      <div style={{ padding: "8px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: roleLabelColor(msg.role), fontFamily: "Courier New, monospace" }}>
            {roleLabel(msg.role)}
            {msg.toolName && (
              <span style={{ marginLeft: 6, color: C.yellow, fontWeight: 400 }}>
                {msg.toolName}
              </span>
            )}
          </span>
          {msg.timestamp && (
            <span style={{ fontSize: 9, color: C.dim, fontFamily: "Courier New, monospace" }}>
              {fmtTime(msg.timestamp)}
            </span>
          )}
        </div>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: msg.role === "toolCall" || msg.role === "toolResult" ? C.muted : C.text,
          lineHeight: 1.5,
          fontFamily: msg.role === "toolCall" || msg.role === "toolResult" ? "Courier New, monospace" : "inherit",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>
          {msg.content}
        </p>
      </div>
    </div>
  );
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function AgentChatContent() {
  const [selectedAgent, setSelectedAgent] = useState("content");
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [isError, setIsError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const sinceParam = showAll ? "" : `&since=${encodeURIComponent(daysAgoISO(7))}`;
      const showAllParam = showAll ? "&showAll=true" : "";
      const res = await fetch(`/api/agent-chat?agent=${selectedAgent}${sinceParam}${showAllParam}`, { cache: "no-store" });
      const json = (await res.json()) as ChatData;
      setChatData(json);
      setIsError(!json.ok);
    } catch (e) {
      setIsError(true);
      setChatData({ ok: false, agent: selectedAgent, messages: [], totalParsed: 0, sessionsMatched: 0, totalSessions: 0, filesRead: [], error: String(e) });
    }
  }, [selectedAgent, showAll]);

  const { isLoading, isRefreshing, lastUpdated, refreshNow } = useVisibilityPolling(load, {
    intervalMs: 30000,
  });

  // Re-fetch immediately when switching agent tabs or toggling date filter
  const [prevAgent, setPrevAgent] = useState(selectedAgent);
  const [prevShowAll, setPrevShowAll] = useState(showAll);
  useEffect(() => {
    if (selectedAgent !== prevAgent || showAll !== prevShowAll) {
      setPrevAgent(selectedAgent);
      setPrevShowAll(showAll);
      setChatData(null);
      void refreshNow();
    }
  }, [selectedAgent, prevAgent, showAll, prevShowAll, refreshNow]);

  const messages = chatData?.messages ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 4 }}>
            Agent Transcripts
          </p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: "Courier New, monospace", margin: 0 }}>
            AGENT CHAT VIEWER
          </h2>
          <p style={{ fontSize: 11, color: C.dim, margin: "4px 0 0" }}>
            Agent-to-agent messages (excludes Telegram DMs) · Auto-refreshes every 30s
          </p>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace", textAlign: "right" }}>
          {isRefreshing ? "Refreshing…" : lastUpdated ? `Updated ${fmtRelative(lastUpdated)}` : ""}
          {chatData?.filesRead && chatData.filesRead.length > 0 && (
            <div style={{ color: C.dim, marginTop: 2, fontSize: 9 }}>
              {chatData.filesRead.join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Agent Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: selectedAgent === agent.id ? `2px solid ${C.green}` : "2px solid transparent",
              color: selectedAgent === agent.id ? C.green : C.muted,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "Courier New, monospace",
              fontSize: 12,
              fontWeight: selectedAgent === agent.id ? 700 : 400,
              transition: "all 0.15s ease",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {agent.label}
          </button>
        ))}
      </div>

      {/* Date Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            background: showAll ? "rgba(0,255,159,0.12)" : "rgba(0,212,255,0.09)",
            border: `1px solid ${showAll ? "rgba(0,255,159,0.3)" : C.border}`,
            color: showAll ? C.green : C.muted,
            padding: "4px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "Courier New, monospace",
            fontSize: 11,
            fontWeight: showAll ? 700 : 400,
          }}
        >
          {showAll ? "✦ Showing all history" : "Last 7 days"}
        </button>
        {chatData && (
          <span style={{ fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace" }}>
            {chatData.sessionsMatched} of {chatData.totalSessions} sessions
            {!showAll && chatData.totalSessions > chatData.sessionsMatched && (
              <span style={{ color: C.muted }}> — click to show all</span>
            )}
          </span>
        )}
      </div>

      {/* Chat Area */}
      {isLoading && messages.length === 0 ? (
        <div style={{ padding: "2rem", color: C.dim, fontFamily: "Courier New, monospace", fontSize: 12, textAlign: "center" }}>
          Loading messages…
        </div>
      ) : isError ? (
        <div style={{
          background: C.card, border: `1px solid rgba(255,176,174,0.3)`, borderRadius: 10,
          padding: 16, color: C.red, fontSize: 12, fontFamily: "Courier New, monospace",
        }}>
          ⚠ Error: {chatData?.error ?? "Failed to load messages"}
        </div>
      ) : messages.length === 0 ? (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "32px", textAlign: "center", color: C.dim, fontSize: 13,
          fontFamily: "Courier New, monospace",
        }}>
          📭 No agent-to-agent sessions yet for {AGENTS.find(a => a.id === selectedAgent)?.label ?? selectedAgent}.
          <br />
          <span style={{ fontSize: 10, marginTop: 4, display: "block" }}>
            No matching sessions found — this agent may not have run yet
          </span>
        </div>
      ) : (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Stats bar */}
          <div style={{
            display: "flex", gap: 16, padding: "8px 14px",
            background: "rgba(0,212,255,0.06)", borderBottom: `1px solid ${C.border}`,
            fontSize: 10, color: C.dim, fontFamily: "Courier New, monospace",
          }}>
            <span><span style={{ color: C.text, fontWeight: 700 }}>{messages.length}</span> messages</span>
            <span><span style={{ color: C.muted }}>{chatData?.sessionsMatched ?? 0}</span>/{chatData?.totalSessions ?? 0} sessions</span>
            <span style={{ color: showAll ? C.green : C.dim }}>{showAll ? "all time" : "last 7d"}</span>
          </div>

          {/* Messages */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 8,
            padding: 14, maxHeight: 600, overflowY: "auto",
          }}>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
