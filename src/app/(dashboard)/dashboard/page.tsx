"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";

// ── Types (same as v1) ───────────────────────────────────────────────

type MarketItem = { symbol: string; price: number; change24h: number; currency: string };
type MarketsData = { ok: boolean; markets?: MarketItem[]; fetchedAt?: string };
type PendingAction = {
  id: string; text: string; priority: "high" | "medium" | "low";
  done: boolean; source?: string; taskId?: string; dueAt?: string;
};
type OfficeMember = {
  id: string; name: string; status: string;
  live?: { model?: string; updatedAt?: string; uptimeHuman?: string };
};
type OfficeData = { members?: OfficeMember[] };
type CronJob = {
  id: string; name: string; lastRunStatus?: string | null;
  nextRunAtMs?: number | null; enabled?: boolean;
};

// ── Palette ───────────────────────────────────────────────────────────

const C = {
  cyan: "#00d4ff",
  purple: "#a855f7",
  teal: "#2dd4bf",
  pink: "#f472b6",
  green: "#00ff88",
  amber: "#fbbf24",
  red: "#ff3366",
  bg: "#050510",
  glass: "rgba(8, 12, 30, 0.65)",
  border: "rgba(0, 212, 255, 0.12)",
  text: "#e2e8f0",
  muted: "#475569",
};

// ── Helpers ───────────────────────────────────────────────────────────

function formatIDR(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
}

function timeAgo(v: string | number | undefined) {
  if (!v) return "—";
  const ms = typeof v === "number" ? v : new Date(v).getTime();
  const d = Date.now() - ms;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function todayWIB() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// ── ScrambleText Component ────────────────────────────────────────────

function ScrambleText({ text, as: Tag = "span", className = "", delay = 0 }: {
  text: string; as?: keyof JSX.IntrinsicElements; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const original = text;
    let frame: number;
    let iteration = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        el.innerText = original
          .split("")
          .map((char, idx) => {
            if (char === " ") return " ";
            if (idx < iteration) return original[idx];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        if (iteration >= original.length) clearInterval(interval);
        iteration += 1 / 2;
      }, 30);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [text, delay]);

  // @ts-expect-error ref type
  return <Tag ref={ref} className={className}>{text}</Tag>;
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState("");
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Live clock
  useEffect(() => {
    function update() {
      const now = new Date();
      const hour = parseInt(now.toLocaleString("en-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }));
      setGreeting(hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : "EVENING");
      setTime(now.toLocaleTimeString("en-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase());
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // GSAP orchestration (effects NOT handled by V2GlobalEffects)
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      // Orbital ring rotation for agents
      const ring = containerRef.current!.querySelector(".v2-orbital-ring");
      if (ring) {
        gsap.to(ring, { rotation: 360, duration: 20, repeat: -1, ease: "none", transformOrigin: "center center" });
      }
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <style suppressHydrationWarning>{`
        .v2-page {
          position: relative;
          min-height: 100vh;
          color: ${C.text};
          font-family: 'Inter', -apple-system, sans-serif;
          padding: 1.5rem;
          padding-bottom: 6rem;
          overflow-x: hidden;
        }
        .v2-content {
          position: relative;
          z-index: 2;
          max-width: 1480px;
          margin: 0 auto;
        }

        /* Bento */
        .v2-bento {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.8rem;
        }
        .v2-span-2 { grid-column: span 2; }
        @media (max-width: 700px) {
          .v2-bento { grid-template-columns: 1fr; }
          .v2-span-2 { grid-column: span 1; }
        }

        /* Card */
        .v2-card {
          position: relative;
          background: ${C.glass};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          will-change: transform;
          transform-style: preserve-3d;
          overflow: hidden;
        }
        .v2-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(135deg, ${C.cyan}44, ${C.purple}44, ${C.teal}22, transparent);
          background-size: 200% 200%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .v2-card:hover {
          box-shadow: 0 0 40px ${C.cyan}12, 0 0 80px ${C.purple}08, 0 16px 48px rgba(0,0,0,0.3);
        }
        .v2-card:hover::before {
          background: linear-gradient(135deg, ${C.cyan}88, ${C.purple}66, ${C.teal}44, transparent);
          background-size: 200% 200%;
        }

        /* Card header */
        .v2-card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px solid ${C.border};
        }
        .v2-card-icon { font-size: 1rem; }
        .v2-card-label {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          background: linear-gradient(90deg, ${C.cyan}, ${C.purple});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Greeting */
        .v2-greeting { margin-bottom: 1.5rem; text-align: center; }
        .v2-terminal {
          font-family: 'SF Mono', 'Courier New', monospace;
          font-size: 1.6rem;
          font-weight: 800;
          background: linear-gradient(90deg, ${C.cyan}, ${C.teal}, ${C.purple});
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: v2-gradient-shift 4s ease infinite;
        }
        @keyframes v2-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .v2-cursor-blink {
          display: inline-block;
          width: 2px;
          height: 1.2em;
          background: ${C.cyan};
          margin-left: 4px;
          vertical-align: text-bottom;
          box-shadow: 0 0 8px ${C.cyan};
          animation: v2-blink 1s step-end infinite;
        }
        @keyframes v2-blink { 50% { opacity: 0; } }
        .v2-date { font-size: 0.75rem; color: ${C.muted}; font-family: monospace; margin-top: 0.4rem; letter-spacing: 0.08em; }
        .v2-status-row { display: flex; justify-content: center; gap: 0.75rem; margin-top: 0.6rem; }
        .v2-status-pill {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          padding: 0.3rem 0.8rem; border-radius: 999px;
          background: ${C.green}11; border: 1px solid ${C.green}33; color: ${C.green};
        }
        .v2-dot-live { width: 6px; height: 6px; border-radius: 50%; background: ${C.green}; box-shadow: 0 0 10px ${C.green}; }

        /* Hero */
        .v2-hero-val {
          font-size: 2.8rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          background: linear-gradient(180deg, ${C.text} 30%, ${C.cyan}88);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
        }
        .v2-hero-lbl {
          font-size: 0.6rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.15em; color: ${C.cyan}; text-align: center;
          opacity: 0.7;
        }

        /* Stats */
        .v2-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
        @media (min-width: 500px) { .v2-stats { grid-template-columns: repeat(4, 1fr); } }
        .v2-stat {
          background: ${C.bg}cc; border: 1px solid ${C.border};
          border-radius: 12px; padding: 0.5rem; text-align: center;
        }
        .v2-stat-val { font-size: 0.95rem; font-weight: 700; color: ${C.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-stat-lbl { font-size: 0.5rem; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Items */
        .v2-items-header { font-size: 0.6rem; font-weight: 800; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem; }
        .v2-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.35rem 0; border-bottom: 1px solid ${C.border}; }
        .v2-rank { font-weight: 800; font-size: 0.7rem; width: 1.5rem; }
        .v2-rank-1 { color: ${C.cyan}; text-shadow: 0 0 12px ${C.cyan}; }
        .v2-rank-n { color: ${C.muted}; }
        .v2-item-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-item-qty { color: ${C.cyan}; font-weight: 700; width: 3rem; text-align: right; }
        .v2-item-rev { color: ${C.muted}; width: 6rem; text-align: right; }

        /* Ticker */
        .v2-ticker-wrap { overflow: hidden; mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); }
        .v2-ticker-track { display: flex; gap: 2rem; width: max-content; }
        .v2-ticker-item { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; font-size: 0.85rem; }
        .v2-ticker-sym { font-weight: 800; }
        .v2-ticker-price { color: ${C.muted}; font-weight: 600; }
        .v2-ticker-up { color: ${C.green}; font-weight: 800; }
        .v2-ticker-down { color: ${C.red}; font-weight: 800; }
        .v2-ticker-sep { color: ${C.cyan}15; }

        /* Agents orbital */
        .v2-agents-layout { display: flex; flex-direction: column; gap: 0.4rem; }
        .v2-agent { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.3rem 0; }
        .v2-agent-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .v2-agent-active { background: ${C.green}; box-shadow: 0 0 10px ${C.green}, 0 0 20px ${C.green}44; }
        .v2-agent-idle { background: ${C.muted}44; border: 1px solid ${C.muted}33; }
        .v2-agent-name { flex: 1; }
        .v2-agent-model {
          font-size: 0.55rem; font-family: monospace; color: ${C.purple};
          background: ${C.purple}12; border: 1px solid ${C.purple}22;
          border-radius: 4px; padding: 0.1rem 0.35rem; white-space: nowrap;
        }
        .v2-agent-time { color: ${C.muted}; font-size: 0.68rem; }

        /* Crons */
        .v2-cron { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.3rem 0; border-bottom: 1px solid ${C.border}; }
        .v2-cron-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-cron-next { color: ${C.muted}; font-size: 0.68rem; white-space: nowrap; font-family: monospace; }

        /* Koto */
        .v2-koto { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.3rem 0; }
        .v2-koto-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .v2-koto-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-koto-dl { font-size: 0.68rem; font-weight: 700; white-space: nowrap; }
        .v2-koto-done { opacity: 0.3; }
        .v2-koto-done .v2-koto-title { text-decoration: line-through; }
        .v2-bl { padding-left: 0.5rem; }
        .v2-bl-overdue { border-left: 3px solid ${C.red}; }
        .v2-bl-urgent { border-left: 3px solid ${C.amber}; }
        .v2-bl-ok { border-left: 3px solid ${C.green}44; }

        /* Pending */
        .v2-pending { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.4rem 0; border-bottom: 1px solid ${C.border}; }
        .v2-pending-flag { font-size: 0.85rem; flex-shrink: 0; }
        .v2-pending-text { flex: 1; line-height: 1.4; }
        .v2-pending-due { font-size: 0.65rem; color: ${C.amber}; white-space: nowrap; }
        .v2-pending-btn {
          background: none; border: 1px solid ${C.border}; color: ${C.muted};
          border-radius: 8px; width: 1.5rem; height: 1.5rem; cursor: pointer;
          font-size: 0.8rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
        }
        .v2-pending-btn:hover { background: ${C.green}22; color: ${C.green}; border-color: ${C.green}; box-shadow: 0 0 12px ${C.green}44; }

        /* Waitlist */
        .v2-wl-count { font-size: 2rem; font-weight: 900; background: linear-gradient(135deg, ${C.cyan}, ${C.purple}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .v2-wl-email { font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .v2-wl-time { color: ${C.muted}; font-size: 0.65rem; flex-shrink: 0; }

        /* Links */
        .v2-link { display: flex; justify-content: space-between; font-size: 0.78rem; padding: 0.25rem 0; }
        .v2-link-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .v2-link-count { color: ${C.cyan}; font-weight: 700; margin-left: 0.5rem; }

        /* Chart */
        .v2-chart-label { font-size: 0.6rem; font-weight: 800; color: ${C.muted}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.5rem; }

        .v2-link-nav { font-size: 0.72rem; color: ${C.cyan}; text-decoration: none; transition: all 0.2s; }
        .v2-link-nav:hover { text-shadow: 0 0 10px ${C.cyan}; }
        .v2-empty { font-size: 0.8rem; color: ${C.muted}; padding: 0.5rem 0; }

        .v2-badge-ok { font-size: 0.58rem; display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${C.green}11; border: 1px solid ${C.green}33; color: ${C.green}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
      `}</style>

      <div className="v2-page" ref={containerRef}>
        <div className="v2-content">
          {/* Greeting */}
          <div className="v2-greeting">
            <div className="v2-terminal">
              <ScrambleText text={`> GOOD ${greeting}, COMMANDER`} delay={0.3} />
              <span className="v2-cursor-blink" />
            </div>
            <div className="v2-date">{dateStr} · {time} WIB</div>
            <div className="v2-status-row">
              <span className="v2-status-pill"><span className="v2-dot-live" /> SYSTEM OPERATIONAL</span>
              <span className="v2-status-pill" style={{ background: `${C.purple}11`, borderColor: `${C.purple}33`, color: C.purple }}>
                ◈ MISSION CONTROL v2
              </span>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="v2-bento">
            <V2SalesCard />
            <V2AgentsCard />
            <V2MarketsCard />
            <V2CronsCard />
            <V2LinksCard />
            <V2WaitlistCard />
            <V2KotoCard />
            <V2PendingCard />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sales Card ────────────────────────────────────────────────────────

function V2SalesCard() {
  return <V2Card icon="🏪" label="Sales" className="v2-span-2"><div className="v2-empty" style={{padding:"1.5rem 0",color:C.muted}}>🔌 Connect your POS or sales API to see live data here</div></V2Card>;
}

// ── Markets ───────────────────────────────────────────────────────────

function V2MarketsCard() {
  const [data, setData] = useState<MarketsData | null>(null);

  const fetchData = useCallback(async () => {
    try { const r = await fetch("/api/markets"); setData(await r.json() as MarketsData); } catch { /* */ }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  useVisibilityPolling(fetchData, { intervalMs: 600_000 });

  const markets = data?.markets ?? [];

  return (
    <V2Card icon="📈" label="Markets" glow className="v2-span-2">
      {!data ? <div className="v2-empty">Loading…</div> : markets.length === 0 ? <div className="v2-empty">No data</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {markets.map(m => (
            <div key={m.symbol} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.4rem 0.6rem", borderRadius: "8px",
              background: "rgba(255,255,255,0.02)",
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontWeight: 800, fontSize: "0.8rem", minWidth: 60 }}>{m.symbol}</span>
              <span style={{ color: C.muted, fontWeight: 600, fontSize: "0.8rem", flex: 1, textAlign: "right", marginRight: "0.8rem" }}>
                {m.currency === "IDR" ? `Rp ${m.price.toLocaleString("id-ID")}` : m.symbol === "BTC" ? `$${m.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${m.price.toFixed(2)}`}
              </span>
              <span style={{
                fontWeight: 800, fontSize: "0.75rem", minWidth: 80, textAlign: "right",
                color: m.change24h >= 0 ? C.green : C.red,
              }}>
                {m.change24h >= 0 ? "▲" : "▼"} {Math.abs(m.change24h).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </V2Card>
  );
}

// ── Agents ────────────────────────────────────────────────────────────

function V2AgentsCard() {
  const [data, setData] = useState<OfficeData | null>(null);
  const fetchData = useCallback(async () => {
    try { const r = await fetch("/api/digital-office"); setData(await r.json() as OfficeData); } catch { /* */ }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  useVisibilityPolling(fetchData, { intervalMs: 30_000 });

  const members = data?.members ?? [];
  const active = members.filter(m => m.status === "active" || m.status === "working");

  return (
    <V2Card icon="🤖" label={`Agents · ${active.length}/${members.length} active`} glow>
      <div className="v2-agents-layout">
        {members.slice(0, 6).map(m => (
          <div className="v2-agent" key={m.id}>
            <span className={`v2-agent-dot ${m.status === "active" || m.status === "working" ? "v2-agent-active" : "v2-agent-idle"}`} />
            <span className="v2-agent-name"><ScrambleText text={m.name} delay={0.8} /></span>
            {m.live?.model && (
              <span className="v2-agent-model">{m.live.model.split("/").pop()?.replace("claude-", "cl-") ?? m.live.model.split("/").pop()}</span>
            )}
            <span className="v2-agent-time">{timeAgo(m.live?.updatedAt)}</span>
          </div>
        ))}
        {members.length === 0 && <div className="v2-empty">No sessions</div>}
      </div>
      <Link href="/digital-office" className="v2-link-nav v2-magnet">View Digital Office →</Link>
    </V2Card>
  );
}

// ── Crons ─────────────────────────────────────────────────────────────

function V2CronsCard() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const fetchData = useCallback(async () => {
    try { const r = await fetch("/api/cron-jobs"); const j = await r.json() as { jobs?: CronJob[] }; setJobs(j.jobs ?? []); } catch { /* */ }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const hasErr = jobs.some(j => j.lastRunStatus && j.lastRunStatus !== "ok");

  return (
    <V2Card icon="⏰" label="Cron Jobs">
      <span className="v2-badge-ok" style={{ marginBottom: "0.4rem", alignSelf: "flex-start" }}>
        <span className="v2-dot-live" style={{ width: 5, height: 5 }} />
        {hasErr ? "CHECK ERRORS" : "ALL SYSTEMS NOMINAL"}
      </span>
      {jobs.slice(0, 5).map(job => {
        const ms = job.nextRunAtMs ? job.nextRunAtMs - Date.now() : null;
        const next = ms !== null && ms > 0
          ? ms < 3600000 ? `in ${Math.round(ms / 60000)}m`
            : ms < 86400000 ? `in ${Math.round(ms / 3600000)}h`
            : `in ${Math.round(ms / 86400000)}d`
          : "—";
        return (
          <div className="v2-cron" key={job.id}>
            <span style={{ color: job.lastRunStatus === "ok" ? C.green : job.lastRunStatus ? C.red : C.muted }}>
              {job.lastRunStatus === "ok" ? "✅" : job.lastRunStatus ? "❌" : "·"}
            </span>
            <span className="v2-cron-name">{job.name}</span>
            <span className="v2-cron-next">{next}</span>
          </div>
        );
      })}
    </V2Card>
  );
}

// ── Links ─────────────────────────────────────────────────────────────

function V2LinksCard() {
  type LS = { ok: boolean; views?: { today: number; last7d: number }; clicks?: { today: number }; topLinks?: { label: string; count: number }[] };
  const [data, setData] = useState<LS | null>(null);
  const fetchData = useCallback(async () => {
    try { const r = await fetch("/api/links-analytics"); setData(await r.json() as LS); } catch { setData(null); }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  useVisibilityPolling(fetchData, { intervalMs: 300_000 });

  return (
    <V2Card icon="🔗" label="yourdomain.com/links">
      {!data ? <div className="v2-empty">Loading…</div> : (
        <>
          <div className="v2-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="v2-stat"><div className="v2-stat-val"><ScrambleText text={String(data.views?.today ?? 0)} delay={1} /></div><div className="v2-stat-lbl">Views today</div></div>
            <div className="v2-stat"><div className="v2-stat-val"><ScrambleText text={String(data.views?.last7d ?? 0)} delay={1.1} /></div><div className="v2-stat-lbl">Views 7d</div></div>
            <div className="v2-stat"><div className="v2-stat-val"><ScrambleText text={String(data.clicks?.today ?? 0)} delay={1.2} /></div><div className="v2-stat-lbl">Clicks</div></div>
          </div>
          {data.topLinks?.slice(0, 4).map((l, i) => (
            <div className="v2-link" key={i}>
              <span className="v2-link-name">#{i + 1} {l.label}</span>
              <span className="v2-link-count">{l.count}×</span>
            </div>
          ))}
        </>
      )}
    </V2Card>
  );
}

// ── Waitlist ──────────────────────────────────────────────────────────

function V2WaitlistCard() {
  return <V2Card icon="✉️" label="Waitlist"><div className="v2-empty" style={{padding:"1rem 0",color:C.muted}}>🔌 Connect your email service</div></V2Card>;
}

// ── Tasks ─────────────────────────────────────────────────────────────

function V2KotoCard() {
  return <V2Card icon="📋" label="Tasks"><div className="v2-empty" style={{padding:"1rem 0",color:C.muted}}>🔌 Connect your project management tool</div></V2Card>;
}

// ── Pending ───────────────────────────────────────────────────────────

const P_COLORS: Record<string, string> = { high: C.red, medium: C.amber, low: C.muted };
const P_ICONS: Record<string, string> = { high: "🔴", medium: "🟡", low: "⚪" };

function V2PendingCard() {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pending-actions").then(r => r.json()).then(d => setActions(d as PendingAction[]));
  }, []);

  async function markDone(id: string) {
    const el = listRef.current?.querySelector(`[data-id="${id}"]`);
    if (el) {
      gsap.to(el, { x: -120, opacity: 0, scale: 0.7, rotateZ: -3, duration: 0.5, ease: "power3.in", onComplete: () => {
        setActions(prev => prev.filter(a => a.id !== id));
      }});
    }
    await fetch("/api/pending-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, done: true }) });
  }

  const pending = actions.filter(a => !a.done);

  return (
    <V2Card icon="📋" label={`Pending · ${pending.length} items`} className="v2-span-2">
      <div ref={listRef}>
        {pending.map(a => (
          <div className="v2-pending" key={a.id} data-id={a.id}>
            <span className="v2-pending-flag" style={{ color: P_COLORS[a.priority] }}>{P_ICONS[a.priority]}</span>
            <span className="v2-pending-text">{a.text}</span>
            {a.dueAt && <span className="v2-pending-due">{new Date(a.dueAt).toLocaleDateString("en-ID", { month: "short", day: "numeric" })}</span>}
            <button className="v2-pending-btn v2-magnet" onClick={() => void markDone(a.id)}>✓</button>
          </div>
        ))}
        {pending.length === 0 && <div className="v2-empty">All clear! 🎉</div>}
      </div>
    </V2Card>
  );
}

// ── Card Shell ────────────────────────────────────────────────────────

function V2Card({ icon, label, children, glow = false, className = "" }: {
  icon: string; label: string; children: React.ReactNode; glow?: boolean; className?: string;
}) {
  return (
    <div className={`v2-card ${glow ? "v2-card-border-anim" : ""} ${className}`}>
      <div className="v2-card-header">
        <span className="v2-card-icon">{icon}</span>
        <span className="v2-card-label">{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
