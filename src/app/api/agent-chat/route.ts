import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const HOME = process.env.HOME ?? "/Users/user";
const AGENTS_BASE = join(HOME, ".openclaw/agents");

/**
 * Dynamic agent tab configuration.
 *
 * Instead of hardcoding agent names, we discover available agents from the
 * filesystem at startup and build patterns automatically. Users can also
 * define custom tab configs via AGENT_CHAT_TABS env var (JSON array of
 * { tab, dirs, patterns } objects).
 *
 * Default behavior per agent dir found under ~/.openclaw/agents/:
 *   - tab name = dir name
 *   - includes main + subagent session keys for that agent
 *   - "community" agents also include telegram:group sessions
 *   - "claude" agents include acp sessions
 */
type TabConfig = { dirs: string[]; includePatterns: RegExp[]; showAllPatterns?: RegExp[] };

function buildDefaultTabConfig(): Record<string, TabConfig> {
  const config: Record<string, TabConfig> = {};

  // Try to discover agent dirs from the filesystem at module load
  // Fallback to a minimal set if the directory doesn't exist
  let agentDirs: string[] = [];
  try {
    const fs = require("node:fs");
    const entries = fs.readdirSync(AGENTS_BASE, { withFileTypes: true });
    agentDirs = entries.filter((e: { isDirectory: () => boolean }) => e.isDirectory()).map((e: { name: string }) => e.name);
  } catch {
    agentDirs = ["main", "claude", "community"];
  }

  for (const dir of agentDirs) {
    if (dir === "claude") {
      config["claude-code"] = {
        dirs: [dir],
        includePatterns: [/^agent:claude:acp:/],
      };
    } else if (dir === "community") {
      config[dir] = {
        dirs: [dir],
        includePatterns: [
          new RegExp(`^agent:${dir}:telegram:group:`),
          new RegExp(`^agent:${dir}:subagent:`),
        ],
      };
    } else {
      // Generic agent: include main + subagent sessions
      config[dir] = {
        dirs: [dir],
        includePatterns: [
          new RegExp(`^agent:${dir}:main$`),
          new RegExp(`^agent:${dir}:subagent:`),
        ],
      };
    }
  }

  return config;
}

const TAB_CONFIG = buildDefaultTabConfig();

// Patterns that look like base64 image data
const BASE64_RE = /(?:\/9j\/|iVBOR|data:image\/)[A-Za-z0-9+/=]{100,}/g;

type ParsedMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "toolResult" | "toolCall" | "unknown";
  content: string;
  timestamp: string | null;
  toolName?: string;
  sessionKey?: string;
};

function sanitizeBase64(text: string): string {
  return text.replace(BASE64_RE, "[image]");
}

function extractContent(msg: Record<string, unknown>): string {
  const content = msg.content;
  if (typeof content === "string") {
    return sanitizeBase64(content);
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          return sanitizeBase64(b.text);
        }
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

function parseRole(msg: Record<string, unknown>): ParsedMessage["role"] {
  const role = String(msg.role ?? "").toLowerCase();
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  if (role === "toolresult") return "toolResult";
  if (role === "toolcall") return "toolCall";
  return "unknown";
}

type SessionEntry = {
  sessionFile?: string;
  sessionId?: string;
  updatedAt?: number;
};

type AcpSessionMeta = SessionEntry & {
  status?: string;
  label?: string;
  acp?: { state?: string };
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
};

async function getFilteredSessionFiles(
  agentDir: string,
  includePatterns: RegExp[],
  opts?: { acpShowAll?: boolean },
): Promise<{ path: string; key: string; updatedAt: number; status?: string; label?: string }[]> {
  const sessionsJsonPath = join(agentDir, "sessions", "sessions.json");
  try {
    const raw = await readFile(sessionsJsonPath, "utf-8");
    const sessions = JSON.parse(raw) as Record<string, AcpSessionMeta>;
    const results: { path: string; key: string; updatedAt: number; status?: string; label?: string }[] = [];

    for (const [key, entry] of Object.entries(sessions)) {
      const matches = includePatterns.some((p) => p.test(key));
      if (!matches) continue;

      // ACP sessions: always show all (done, failed, etc.) — no status filtering

      const filePath = entry.sessionFile ?? join(agentDir, "sessions", `${entry.sessionId}.jsonl`);
      results.push({
        path: filePath,
        key,
        updatedAt: entry.updatedAt ?? 0,
        status: entry.status,
        label: entry.label,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function parseJsonlMessages(filePath: string, sessionKey?: string): Promise<ParsedMessage[]> {
  try {
    const text = await readFile(filePath, "utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
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
        if (!content) continue;

        // Skip messages that are just untrusted metadata blocks
        if (content.startsWith("Conversation info (untrusted metadata)")) continue;

        const timestamp = entry.timestamp ? String(entry.timestamp) : null;
        const toolName = extractToolName(msgWrapper);

        messages.push({
          id: String(entry.id ?? Math.random()),
          role,
          content,
          timestamp,
          toolName,
          sessionKey,
        });
      } catch {
        // skip malformed lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentParam = searchParams.get("agent") ?? "main";
  const sinceParam = searchParams.get("since"); // ISO date string or null for "all"
  const showAll = searchParams.get("showAll") === "true";

  const config = TAB_CONFIG[agentParam];
  if (!config) {
    return NextResponse.json({ ok: false, error: "Unknown agent", messages: [] });
  }

  // Use expanded patterns when showAll is true (includes ACP for main tab)
  const patterns = (showAll && config.showAllPatterns) ? config.showAllPatterns : config.includePatterns;
  // When showAll, main tab also needs to scan the claude agent dir for ACP sessions
  const dirs = (showAll && config.showAllPatterns && agentParam === "main")
    ? [...new Set([...config.dirs, "claude"])]
    : config.dirs;

  try {
    // Collect session files from all configured dirs
    const allSessionFiles: { path: string; key: string; updatedAt: number; status?: string; label?: string }[] = [];

    for (const dir of dirs) {
      const agentDir = join(AGENTS_BASE, dir);
      const files = await getFilteredSessionFiles(agentDir, patterns, {
        acpShowAll: showAll,
      });
      allSessionFiles.push(...files);
    }

    const totalSessions = allSessionFiles.length;

    if (totalSessions === 0) {
      return NextResponse.json({ ok: true, messages: [], agent: agentParam, sessionsMatched: 0, totalSessions: 0 });
    }

    // Sort by updatedAt descending
    allSessionFiles.sort((a, b) => b.updatedAt - a.updatedAt);

    // Apply date filter if provided
    const sinceMs = sinceParam ? new Date(sinceParam).getTime() : 0;
    const filteredSessions = sinceMs > 0
      ? allSessionFiles.filter((s) => s.updatedAt >= sinceMs)
      : allSessionFiles;

    if (filteredSessions.length === 0) {
      return NextResponse.json({
        ok: true, messages: [], agent: agentParam,
        sessionsMatched: 0, totalSessions,
      });
    }

    // Parse ALL messages from ALL matching sessions (no cap)
    const allMessages: ParsedMessage[] = [];
    for (const session of filteredSessions) {
      const msgs = await parseJsonlMessages(session.path, session.key);
      allMessages.push(...msgs);
    }

    // Sort by timestamp
    allMessages.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({
      ok: true,
      agent: agentParam,
      messages: allMessages,
      totalParsed: allMessages.length,
      sessionsMatched: filteredSessions.length,
      totalSessions,
      sessionKeys: filteredSessions.map((s) => s.key),
      filesRead: filteredSessions.map((s) => s.path.split("/").pop()),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), messages: [] });
  }
}
