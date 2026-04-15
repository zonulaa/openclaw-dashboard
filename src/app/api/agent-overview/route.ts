import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { callGatewayMethod } from "@/lib/openclaw-gateway";

export const runtime = "nodejs";

const HOME = process.env.HOME ?? "/Users/user";

// ── Helper: count dirs matching a glob prefix ─────────────────────
async function countDirs(base: string, prefix: string): Promise<number> {
  try {
    const entries = await readdir(base);
    return entries.filter((e) => e.startsWith(prefix)).length;
  } catch {
    return 0;
  }
}

// ── Helper: count mp4 files in a directory tree ───────────────────
async function countMp4s(dir: string): Promise<{ total: number; ready: number }> {
  try {
    let total = 0;
    let ready = 0;
    const walk = async (d: string) => {
      const entries = await readdir(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          if (e.name === "ready") {
            const inner = await readdir(join(d, e.name));
            const mp4s = inner.filter((f) => f.endsWith(".mp4")).length;
            ready += mp4s;
            total += mp4s;
          } else {
            await walk(join(d, e.name));
          }
        } else if (e.name.endsWith(".mp4")) {
          total += 1;
        }
      }
    };
    await walk(dir);
    return { total, ready };
  } catch {
    return { total: 0, ready: 0 };
  }
}

// ── Helper: parse JSON file safely ───────────────────────────────
async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ── Helper: get live sessions from gateway ────────────────────────
async function getLiveSessions() {
  try {
    const result = (await callGatewayMethod("status", {}, 8000)) as Record<string, unknown>;
    const sessionsObj = result?.sessions as Record<string, unknown> | undefined;
    const recent = Array.isArray(sessionsObj?.recent)
      ? (sessionsObj!.recent as Record<string, unknown>[])
      : [];
    return recent;
  } catch {
    return [];
  }
}

// ── Agent trade data types ─────────────────────────────────────────
type BoxState = {
  date?: string;
  box_high?: number;
  box_low?: number;
  current_zone?: string;
  current_price?: number;
};

type Trade = {
  id?: string;
  direction?: string;
  pnl_usd?: number;
  status?: string;
};

export async function GET() {
  // Run all data fetches in parallel
  const [AgentClips, boxState, trades, sessions] = await Promise.all([
    countMp4s(join(HOME, ".openclaw/workspace/clipper-agent/clips")),
    readJsonFile<BoxState>(
      join(HOME, ".openclaw/workspace/projects/Agent-trader/data/box-state.json")
    ),
    readJsonFile<Trade[]>(
      join(HOME, ".openclaw/workspace/projects/Agent-trader/data/trades.json")
    ),
    getLiveSessions(),
  ]);

  // Figure out live status per agent
  const findSession = (agentId: string) =>
    sessions.find((s) => {
      const rawKey = String(s.rawKey ?? s.key ?? s.label ?? "");
      return rawKey.startsWith(`agent:${agentId}:`) || String(s.agentId ?? "") === agentId;
    });

  const mainSession = sessions.find((s) => Boolean(s.isMain));
  const AgentSession = findSession("Agent");
  const communitySession = findSession("community");

  const sessionStatus = (s: Record<string, unknown> | undefined): "active" | "idle" => {
    if (!s) return "idle";
    const state = String(s.state ?? s.status ?? "").toLowerCase();
    if (["running", "active", "working", "busy"].some((t) => state.includes(t))) return "active";
    return "idle";
  };

  // Agent PnL
  const tradeList = Array.isArray(trades) ? trades : [];
  const totalPnl = tradeList.reduce((acc, t) => acc + (t.pnl_usd ?? 0), 0);
  const closedTrades = tradeList.filter((t) => t.status === "closed").length;

  // Context % for main orchestrator
  const ctxTokens = mainSession
    ? Number((mainSession as Record<string, unknown>).totalTokens ?? 0)
    : 0;
  const ctxMax = mainSession
    ? Number((mainSession as Record<string, unknown>).contextTokens ?? 200000)
    : 200000;
  const mainContextPct = ctxMax > 0 ? Math.round((ctxTokens / ctxMax) * 100) : 0;

  // Last activity helper
  const lastActivity = (s: Record<string, unknown> | undefined): string | null => {
    if (!s) return null;
    const ua = s.updatedAt ?? s.lastMessageAt;
    if (!ua) return null;
    if (typeof ua === "number") return new Date(ua).toISOString();
    return String(ua);
  };

  const data = {
    fetchedAt: new Date().toISOString(),
    agents: {
      main: {
        id: "main",
        name: "Main Agent",
        emoji: "🤖",
        model: "claude-opus-4",
        status: mainSession ? sessionStatus(mainSession as Record<string, unknown>) : "idle",
        contextPct: mainContextPct,
        lastActivity: lastActivity(mainSession as Record<string, unknown> | undefined),
        sessionId: mainSession ? String(mainSession.sessionId ?? mainSession.id ?? "") : null,
      },
      clipper: {
        id: "clipper",
        name: "Clipper Agent",
        emoji: "🤖",
        model: "GLM-4.7",
        status: AgentSession ? sessionStatus(AgentSession as Record<string, unknown>) : "idle",
        clipsTotal: AgentClips.total,
        clipsReady: AgentClips.ready,
        lastActivity: lastActivity(AgentSession as Record<string, unknown> | undefined),
      },
      trader: {
        id: "trader",
        name: "Trader Agent",
        emoji: "📈",
        model: "GLM-4.7 (cron)",
        status: "idle" as const,
        boxDate: boxState?.date ?? null,
        currentZone: boxState?.current_zone ?? null,
        currentPrice: boxState?.current_price ?? null,
        tradesCount: tradeList.length,
        closedTrades,
        totalPnlUsd: Math.round(totalPnl * 100) / 100,
      },
      community: {
        id: "community",
        name: "Community",
        emoji: "💬",
        model: "GLM-4.7",
        status: communitySession ? sessionStatus(communitySession as Record<string, unknown>) : "idle",
        lastActivity: lastActivity(communitySession as Record<string, unknown> | undefined),
      },
    },
    activeSessions: sessions
      .filter((s) => {
        const state = String((s as Record<string, unknown>).state ?? (s as Record<string, unknown>).status ?? "").toLowerCase();
        return !["done", "killed", "failed", "error", "completed"].some((t) => state.includes(t));
      })
      .slice(0, 20)
      .map((s) => {
        const sess = s as Record<string, unknown>;
        return {
          id: String(sess.sessionId ?? sess.id ?? ""),
          label: String(sess.label ?? sess.id ?? ""),
          rawKey: String(sess.rawKey ?? sess.key ?? ""),
          agentId: String(sess.agentId ?? "main"),
          model: String(sess.model ?? "—"),
          state: String(sess.state ?? sess.status ?? "idle"),
          isMain: Boolean(sess.isMain),
          updatedAt: sess.updatedAt
            ? typeof sess.updatedAt === "number"
              ? new Date(sess.updatedAt).toISOString()
              : String(sess.updatedAt)
            : null,
          contextPct:
            sess.contextTokens && sess.totalTokens
              ? Math.round((Number(sess.totalTokens) / Number(sess.contextTokens)) * 100)
              : null,
        };
      }),
  };

  return NextResponse.json(data);
}
