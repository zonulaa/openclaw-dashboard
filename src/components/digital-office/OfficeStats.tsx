"use client";

import type { OfficeMember } from "@/lib/digital-office-live";
import { inferDeskStatus } from "./DeskGrid";

type OfficeStatsProps = {
  members: OfficeMember[];
};

const TOTAL_DESKS = 6;

export function OfficeStats({ members }: OfficeStatsProps) {
  const working = members.filter((m) => inferDeskStatus(m) === "working").length;
  const thinking = members.filter((m) => inferDeskStatus(m) === "thinking").length;
  const idle = members.filter((m) => inferDeskStatus(m) === "idle").length;
  const available = Math.max(0, TOTAL_DESKS - members.length);
  const total = members.length;

  return (
    <div className="pixel-stats" role="status" aria-label="Office status summary">
      <span style={{ color: "#6b7280", fontSize: "9px", letterSpacing: "1px" }}>STATUS:</span>

      <span>
        <span className="pixel-stats__working">{working}</span>
        <span className="pixel-stats__label"> WORKING</span>
      </span>

      {thinking > 0 && (
        <>
          <span className="pixel-stats__separator">|</span>
          <span>
            <span style={{ color: "#A8E6CF", fontWeight: "bold" }}>{thinking}</span>
            <span className="pixel-stats__label"> THINKING</span>
          </span>
        </>
      )}

      <span className="pixel-stats__separator">|</span>

      <span>
        <span className="pixel-stats__idle">{idle}</span>
        <span className="pixel-stats__label"> IDLE</span>
      </span>

      <span className="pixel-stats__separator">|</span>

      <span>
        <span className="pixel-stats__available">{available}</span>
        <span className="pixel-stats__label"> AVAILABLE</span>
      </span>

      <span className="pixel-stats__separator">|</span>

      <span>
        <span style={{ color: "#475569", fontWeight: "bold" }}>{total}</span>
        <span className="pixel-stats__label"> TOTAL</span>
      </span>
    </div>
  );
}
