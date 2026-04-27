import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENTS_BASE, discoverInstalledAgents } from "@/lib/agent-discovery";

export const runtime = "nodejs";

// ── Agent config ──────────────────────────────────────────────────
type AgentConfig = {
  dirs: string[];
  label: string;
  emoji: string;
  /** Patterns for "Reports to user" bucket (main sessions) */
  mainPatterns: RegExp[];
  /** Patterns for "Subagent Work" bucket */
  subagentPatterns: RegExp[];
  /** Extra patterns (telegram groups, etc.) */
  extraPatterns?: RegExp[];
  /** Optional second-pass matcher for agents that relay through main */
  includeSession?: (key: string, meta: SessionMeta, summary?: string) => boolean;
};

// Build configs by scanning ~/.openclaw/agents/ at request time. Every
// directory there becomes an entry; the agent's session keys live under
// `agent:<id>:...` so the patterns below are uniform across agent types
// (a freshly-installed "lena" gets the same buckets as "main").
async function buildAgentConfigs(): Promise<Record<string, AgentConfig>> {
  const configs: Record<string, AgentConfig> = {};
  const installed = await discoverInstalledAgents();

  for (const agent of installed) {
    const id = agent.id;
    configs[id] = {
      dirs: [agent.dir],
      label: agent.label,
      emoji: agent.emoji,
      mainPatterns: [
        new RegExp(`^agent:${id}:main$`),
        new RegExp(`^agent:${id}:telegram:group:`),
        new RegExp(`^agent:${id}:acp:`),
      ],
      subagentPatterns: [new RegExp(`^agent:${id}:subagent:`)],
      extraPatterns: [
        new RegExp(`^agent:${id}:telegram:direct:`),
        new RegExp(`^agent:${id}:telegram:slash:`),
        new RegExp(`^agent:${id}:cron:`),
      ],
    };
  }

  return configs;
}

// ── Types ─────────────────────────────────────────────────────────
type SessionMeta = {
  sessionId?: string;
  sessionFile?: string;
  updatedAt?: number;
  status?: string;
  label?: string;
  model?: string;
  modelProvider?: string;
  spawnedBy?: string;
  spawnDepth?: number;
  subagentRole?: string;
  chatType?: string;
  channel?: string;
  groupChannel?: string;
  origin?: { label?: string; surface?: string; chatType?: string };
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  acp?: { state?: string };
};

export type InboxSession = {
  key: string;
  agentId: string;
  bucket: "main" | "subagent" | "system" | "extra";
  label: string;
  sourceType: "main" | "subagent" | "cron" | "acp" | "telegram" | "manual" | "internal_dev";
  qaState: "running" | "submitted" | "in_review" | "revision_requested" | "approved" | "blocked" | "failed" | "idle";
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

export type InboxResponse = {
  ok: boolean;
  agents: Record<string, {
    label: string;
    emoji: string;
    sessions: InboxSession[];
  }>;
  dailyMeeting: Record<string, InboxSession[]>;
  error?: string;
};

export type SessionMessagesResponse = {
  ok: boolean;
  messages: ParsedMessage[];
  error?: string;
};

type ParsedMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "toolResult" | "toolCall" | "unknown";
  content: string;
  timestamp: string | null;
  toolName?: string;
};

// ── Helpers ───────────────────────────────────────────────────────

const BASE64_RE = /(?:\/9j\/|iVBOR|data:image\/)[A-Za-z0-9+/=]{100,}/g;
const SUBAGENT_CONTEXT_RE = /^\s*\[Subagent Context\][\s\S]*?(?=\n\s*\[Subagent Task\]:|\n\s*Task:|$)/i;
const SESSION_PREFIX_RE = /^\s*\[[^\]]+\]\s*/;
const SYSTEM_LABEL_RE = /(heartbeat|cron:|morning briefing|nightly|standup|daily summary|self-learning)/i;
const NOISY_LABEL_RE = /\b(test|debug|tmp|temp|dev-agent|claude-labeled|scratch)\b/i;

function sanitizeBase64(text: string): string {
  return text.replace(BASE64_RE, "[image]");
}

function cleanSnippet(raw: string): string {
  return sanitizeBase64(raw)
    .replace(SUBAGENT_CONTEXT_RE, "")
    .replace(SESSION_PREFIX_RE, "")
    .replace(/\bYou are running as a subagent[^\n]*/gi, "")
    .replace(/\bYou are an autonomous [^.]+\.?/gi, "")
    .replace(/\bAvailable tools:[^\n]*/gi, "")
    .replace(/\bResults auto-announce[^\n]*/gi, "")
    .replace(/\bKeep it concise but informative\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isSystemSession(key: string, meta: SessionMeta, text = ""): boolean {
  const haystack = `${key} ${meta.label ?? ""} ${meta.groupChannel ?? ""} ${meta.origin?.label ?? ""} ${text}`;
  return SYSTEM_LABEL_RE.test(haystack);
}

function isNoisyHistory(label: string, summary: string): boolean {
  return NOISY_LABEL_RE.test(`${label} ${summary}`);
}

function deriveSourceType(key: string, meta: SessionMeta): InboxSession["sourceType"] {
  if (key.includes(":subagent:")) return "subagent";
  if (key.includes(":cron:")) return "cron";
  if (key.includes(":acp:")) return "acp";
  if (key.includes(":telegram:")) return "telegram";
  if (key.includes(":main") && !key.includes(":subagent:")) return "main";
  if (meta.spawnDepth && meta.spawnDepth > 0) return "subagent";
  return "manual";
}

function deriveQaState(meta: SessionMeta): InboxSession["qaState"] {
  const s = (meta.status ?? "").toLowerCase();
  const acpState = meta.acp?.state?.toLowerCase();

  if (s === "running" || s === "active" || acpState === "running") return "running";
  if (s === "failed" || s === "error" || acpState === "failed") return "failed";
  if (s === "done" || s === "completed" || acpState === "done" || acpState === "completed") return "submitted";
  if (s === "idle" || s === "") return "idle";
  return "submitted";
}

function deriveLabel(key: string, meta: SessionMeta, summary = ""): string {
  const preferred = [meta.label, meta.groupChannel, meta.origin?.label]
    .map(value => cleanSnippet(value ?? ""))
    .find(value => value && value !== "?");
  if (preferred) return preferred.slice(0, 80);
  if (/retrieval before answering|conversation scope|lcm/i.test(summary)) return "LCM retrieval task";
  if (summary) {
    const titleFromSummary = summary.split(/[.:]/)[0]?.trim();
    if (titleFromSummary && titleFromSummary.length > 8 && !/^(you are|read |follow |available tools)/i.test(titleFromSummary)) {
      return titleFromSummary.slice(0, 80);
    }
  }
  // Derive from key
  const parts = key.split(":");
  if (parts.length >= 4) return titleCase(parts.slice(2).join(" ")).slice(0, 50);
  return key.slice(0, 40);
}

function deriveWho(key: string, agentId: string, config: AgentConfig): string {
  if (key.includes(":subagent:")) return `${config.label} \u2192 subagent`;
  if (key.includes(":telegram:group:")) return `${config.label} (group)`;
  if (key.includes(":telegram:direct:")) return "Direct DM";
  if (key.includes(":acp:")) return "Claude Code (ACP)";
  if (key.includes(":cron:")) return `${config.label} (cron)`;
  if (key.includes(":main")) return `Main \u2194 ${config.label}`;
  return config.label;
}

function classifyBucket(key: string, config: AgentConfig, meta: SessionMeta, summary = ""): "main" | "subagent" | "system" | "extra" {
  if (isSystemSession(key, meta, summary)) return "system";
  if (config.subagentPatterns.some(p => p.test(key))) return "subagent";
  if (config.mainPatterns.some(p => p.test(key))) return "main";
  return "extra";
}

async function countMessages(filePath: string): Promise<{ count: number; firstUserMsg: string }> {
  try {
    const text = await readFile(filePath, "utf-8");
    const lines = text.split("\n").filter(l => l.trim());
    let count = 0;
    let firstUserMsg = "";
    let parsedAnyJson = false;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        parsedAnyJson = true;
        if (entry.type !== "message") continue;
        const msg = entry.message as Record<string, unknown> | undefined;
        if (!msg) continue;
        const role = String(msg.role ?? "").toLowerCase();
        if (role === "system" || role === "unknown") continue;
        count++;
        if (!firstUserMsg && role === "user") {
          const content = extractContentShort(msg);
          if (content && !content.startsWith("Conversation info")) {
            firstUserMsg = cleanSnippet(content).slice(0, 160);
          }
        }
      } catch { /* skip */ }
    }
    if (!parsedAnyJson) {
      return { count: lines.length, firstUserMsg: cleanSnippet(lines[0] ?? "").slice(0, 160) };
    }
    return { count, firstUserMsg };
  } catch {
    return { count: 0, firstUserMsg: "" };
  }
}

function extractContentShort(msg: Record<string, unknown>): string {
  const content = msg.content;
  if (typeof content === "string") return sanitizeBase64(content).slice(0, 200);
  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          return sanitizeBase64(b.text).slice(0, 200);
        }
      }
    }
  }
  return "";
}

function shouldKeepSession(session: InboxSession): boolean {
  const ageMs = Date.now() - (session.updatedAt || 0);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (session.qaState === "running" || session.qaState === "in_review" || session.qaState === "revision_requested" || session.qaState === "blocked") {
    return true;
  }
  if (session.qaState === "failed") return ageDays <= 5;
  if (session.qaState === "submitted") return ageDays <= 3 && !isNoisyHistory(session.label, session.taskSummary);
  if (session.qaState === "approved" || session.qaState === "idle") return ageDays <= 7 && !isNoisyHistory(session.label, session.taskSummary);
  return ageDays <= 7;
}

// ── Full message parser (for session detail view) ─────────────────

function parseRole(msg: Record<string, unknown>): ParsedMessage["role"] {
  const role = String(msg.role ?? "").toLowerCase();
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  if (role === "toolresult") return "toolResult";
  if (role === "toolcall") return "toolCall";
  return "unknown";
}

function extractContent(msg: Record<string, unknown>): string {
  const content = msg.content;
  if (typeof content === "string") return sanitizeBase64(content);
  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") return sanitizeBase64(b.text);
        if (b.type === "toolCall") {
          const args = b.arguments;
          const argStr = typeof args === "object" ? JSON.stringify(args).slice(0, 100) : String(args ?? "");
          return `[Tool: ${b.name ?? "unknown"}] ${argStr}`;
        }
        if (b.type === "toolResult") {
          const inner = b.content;
          if (Array.isArray(inner)) {
            const text = inner.find(
              (i): i is { type: string; text: string } =>
                typeof i === "object" && i !== null && (i as Record<string, unknown>).type === "text"
            );
            if (text) return sanitizeBase64(text.text);
          }
          if (typeof inner === "string") return sanitizeBase64(inner);
          return "[Tool result]";
        }
      }
    }
    return sanitizeBase64(JSON.stringify(content));
  }
  return "";
}

function extractToolName(msg: Record<string, unknown>): string | undefined {
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === "toolCall" && typeof b.name === "string") return b.name;
      }
    }
  }
  return undefined;
}

async function parseSessionMessages(filePath: string): Promise<ParsedMessage[]> {
  try {
    const text = await readFile(filePath, "utf-8");
    const lines = text.split("\n").filter(l => l.trim());
    const messages: ParsedMessage[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        if (entry.type !== "message") continue;
        const msgWrapper = entry.message as Record<string, unknown> | undefined;
        if (!msgWrapper) continue;
        const role = parseRole(msgWrapper);
        if (role === "system" || role === "unknown") continue;
        const content = extractContent(msgWrapper);
        if (!content || content.startsWith("Conversation info (untrusted metadata)")) continue;
        const timestamp = entry.timestamp ? String(entry.timestamp) : null;
        messages.push({
          id: String(entry.id ?? Math.random()),
          role,
          content,
          timestamp,
          toolName: extractToolName(msgWrapper),
        });
      } catch {
        return lines.map((plain, index) => ({
          id: `plain-${index}`,
          role: "assistant",
          content: sanitizeBase64(plain),
          timestamp: null,
        } satisfies ParsedMessage));
      }
    }
    return messages;
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // If requesting messages for a specific session
  const sessionFile = searchParams.get("sessionFile");
  if (sessionFile) {
    try {
      const messages = await parseSessionMessages(sessionFile);
      return NextResponse.json({ ok: true, messages } satisfies SessionMessagesResponse);
    } catch (err) {
      return NextResponse.json({ ok: false, messages: [], error: String(err) } satisfies SessionMessagesResponse);
    }
  }

  // Otherwise return the full inbox index
  try {
    const result: InboxResponse = { ok: true, agents: {}, dailyMeeting: {} };

    // Only show sessions updated in the last 14 days (active ones always pass)
    const RECENCY_CUTOFF_MS = 14 * 24 * 60 * 60 * 1000;
    const recencyCutoff = Date.now() - RECENCY_CUTOFF_MS;
    const ACTIVE_STATES = new Set(["running", "active", "failed", "error"]);

    const AGENT_CONFIGS = await buildAgentConfigs();
    for (const [agentId, config] of Object.entries(AGENT_CONFIGS)) {
      const sessions: InboxSession[] = [];

      for (const dir of config.dirs) {
        const sessionsJsonPath = join(AGENTS_BASE, dir, "sessions", "sessions.json");
        let rawSessions: Record<string, SessionMeta>;
        try {
          const raw = await readFile(sessionsJsonPath, "utf-8");
          rawSessions = JSON.parse(raw) as Record<string, SessionMeta>;
        } catch {
          continue;
        }

        const allPatterns = [
          ...config.mainPatterns,
          ...config.subagentPatterns,
          ...(config.extraPatterns ?? []),
        ];

        for (const [key, meta] of Object.entries(rawSessions)) {
          if (!allPatterns.some(p => p.test(key))) continue;
          if (config.includeSession && !config.includeSession(key, meta)) continue;

          // Skip stale idle sessions outside recency window
          const ts = meta.updatedAt ?? 0;
          const status = (meta.status ?? "").toLowerCase();
          if (ts < recencyCutoff && !ACTIVE_STATES.has(status)) continue;

          const filePath = meta.sessionFile ?? join(AGENTS_BASE, dir, "sessions", `${meta.sessionId}.jsonl`);
          const { count, firstUserMsg } = await countMessages(filePath);

          const cleanedSummary = cleanSnippet(firstUserMsg);
          if (config.includeSession && !config.includeSession(key, meta, cleanedSummary)) continue;
          const bucket = classifyBucket(key, config, meta, cleanedSummary);
          const label = deriveLabel(key, meta, cleanedSummary);

          sessions.push({
            key,
            agentId,
            bucket,
            label,
            sourceType: deriveSourceType(key, meta),
            qaState: deriveQaState(meta),
            model: meta.model ?? meta.modelProvider ?? "unknown",
            updatedAt: ts,
            startedAt: meta.startedAt ?? ts,
            messageCount: count,
            taskSummary: cleanedSummary,
            who: deriveWho(key, agentId, config),
            sessionFile: filePath,
            spawnedBy: meta.spawnedBy ?? null,
            groupChannel: meta.groupChannel ?? null,
          });
        }
      }

      const filteredSessions = sessions.filter(shouldKeepSession).sort((a, b) => b.updatedAt - a.updatedAt);

      result.agents[agentId] = {
        label: config.label,
        emoji: config.emoji,
        sessions: filteredSessions,
      };
    }

    // Build daily meeting: one useful async standup thread per day, exclude hidden/system buckets
    const allSessions: InboxSession[] = [];
    for (const agent of Object.values(result.agents)) {
      allSessions.push(...agent.sessions.filter(s => s.bucket === "main" || s.bucket === "subagent"));
    }
    allSessions.sort((a, b) => b.updatedAt - a.updatedAt);

    for (const session of allSessions) {
      if (session.updatedAt === 0) continue;
      const dateKey = new Date(session.updatedAt).toISOString().slice(0, 10);
      if (!result.dailyMeeting[dateKey]) result.dailyMeeting[dateKey] = [];
      result.dailyMeeting[dateKey].push(session);
    }

    for (const [dateKey, sessions] of Object.entries(result.dailyMeeting)) {
      const useful = sessions
        .filter(session => session.messageCount > 0 && (session.taskSummary || session.label))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (useful.length === 0) delete result.dailyMeeting[dateKey];
      else result.dailyMeeting[dateKey] = useful;
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, agents: {}, dailyMeeting: {}, error: String(err) } satisfies InboxResponse);
  }
}
