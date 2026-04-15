"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import "@/components/styles/pixelated-office.css";
import { DeskGrid } from "./DeskGrid";
import { OfficeStats } from "./OfficeStats";
import type { OfficeMember } from "@/lib/digital-office-live";

type OfficeData = {
  members: OfficeMember[];
  degraded?: boolean;
  reason?: string;
};

const POLL_INTERVAL_MS = 3000;

export function PixelatedOffice() {
  const [data, setData] = useState<OfficeData>({ members: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevMemberIds = useRef<Set<string>>(new Set());
  const [newMemberIds, setNewMemberIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/digital-office", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OfficeData;
      const members = Array.isArray(json.members) ? json.members : [];

      // Track new members for fade-in
      const currentIds = new Set(members.map((m) => m.id));
      const fresh = new Set<string>();
      for (const id of currentIds) {
        if (!prevMemberIds.current.has(id)) {
          fresh.add(id);
        }
      }
      prevMemberIds.current = currentIds;
      setNewMemberIds(fresh);

      setData({ members, degraded: json.degraded, reason: json.reason });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => { void fetchData(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const now = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour12: false })
    : "—";

  return (
    <div className="pixel-office">
      {/* Header */}
      <div className="pixel-office__header">
        <div>
          <div className="pixel-office__title">📊 OpenClaw Digital Office</div>
          <div className="pixel-office__subtitle">AGENT WORKSTATIONS · LIVE</div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "9px", color: "#4a4a7a", fontFamily: "Courier New" }}>
            UPDATED: {now}
          </div>
          {syncing && (
            <div style={{ fontSize: "9px", color: "#00FF9F", fontFamily: "Courier New" }}>
              ● SYNCING...
            </div>
          )}
          {!syncing && !loading && !error && (
            <div style={{ fontSize: "9px", color: "#2a4a3a", fontFamily: "Courier New" }}>
              ● LIVE
            </div>
          )}
          {error && (
            <div style={{ fontSize: "9px", color: "#FF6B6B", fontFamily: "Courier New" }}>
              ✖ {error}
            </div>
          )}
          {data.degraded && (
            <div style={{ fontSize: "9px", color: "#FFE66D", fontFamily: "Courier New" }}>
              ⚠ DEGRADED
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && data.members.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "240px",
            color: "#00FF9F",
            fontFamily: "Courier New",
            fontSize: "12px",
            letterSpacing: "2px",
          }}
        >
          <span style={{ animation: "blink 1s step-end infinite" }}>LOADING...</span>
        </div>
      )}

      {/* Desk Grid */}
      {(!loading || data.members.length > 0) && (
        <DeskGrid members={data.members} newMemberIds={newMemberIds} />
      )}

      {/* Stats bar */}
      <OfficeStats members={data.members} />

      {/* Degraded reason */}
      {data.degraded && data.reason && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px",
            border: "2px solid #FFE66D33",
            background: "#FFE66D11",
            fontSize: "9px",
            color: "#FFE66D",
            fontFamily: "Courier New",
            letterSpacing: "0.5px",
          }}
        >
          ⚠ {data.reason}
        </div>
      )}
    </div>
  );
}
