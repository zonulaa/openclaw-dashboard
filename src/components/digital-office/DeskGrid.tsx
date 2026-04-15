"use client";

import type { OfficeMember } from "@/lib/digital-office-live";
import { Desk, type DeskStatus, type DeskConfig } from "./Desk";

type DeskGridProps = {
  members: OfficeMember[];
  newMemberIds?: Set<string>;
};

const RECENT_THRESHOLD_MS = 30_000; // 30s = "working"
const IDLE_THRESHOLD_MS = 300_000;  // 5min = "idle"

export function inferDeskStatus(member: OfficeMember | null | undefined): DeskStatus {
  if (!member) return "empty";

  const status = (member.status || "").toLowerCase();
  const detail = (member.statusDetail || "").toLowerCase();
  const combined = `${status} ${detail}`;

  if (
    combined.includes("active") ||
    combined.includes("running") ||
    combined.includes("busy") ||
    combined.includes("working")
  ) {
    // Check recency
    const updatedAt = member.live?.updatedAt;
    if (updatedAt) {
      const age = Date.now() - Date.parse(updatedAt);
      if (age < RECENT_THRESHOLD_MS) return "working";
      if (age < IDLE_THRESHOLD_MS) return "thinking";
      return "idle";
    }
    return "working";
  }

  if (combined.includes("think") || combined.includes("processing")) {
    return "thinking";
  }

  if (combined.includes("idle") || combined.includes("queued") || combined.includes("waiting")) {
    return "idle";
  }

  // Default: if there's a session, mark as working (recently seen = working)
  const updatedAt = member.live?.updatedAt;
  if (updatedAt) {
    const age = Date.now() - Date.parse(updatedAt);
    if (age < RECENT_THRESHOLD_MS) return "working";
    if (age < IDLE_THRESHOLD_MS) return "idle";
  }

  return "idle";
}

/**
 * Derive a stable agentKey for sprite lookup from a live member.
 * Main sessions → "agent:main:main"
 * Subagent sessions → "subagent"
 * Others → "subagent" (fallback)
 */
function agentKeyForMember(member: OfficeMember): string {
  if (member.live?.isMain) return "agent:main:main";
  const role = (member.role || "").toLowerCase();
  if (role.includes("subagent") || role.includes("worker")) return "subagent";
  return "subagent";
}

/**
 * Detect which room a member belongs to based on the raw session key.
 * "main"      → key contains "agent:main:" or isMain or no key
 * "community" → key contains "agent:community:"
 */
function memberRoom(member: OfficeMember): "main" | "community" {
  const rawKey = member.live?.rawKey ?? "";
  if (rawKey.includes("agent:community:")) return "community";
  return "main";
}

type RoomSectionProps = {
  label: string;
  emoji: string;
  members: OfficeMember[];
  newMemberIds?: Set<string>;
  accentColor: string;
};

function RoomSection({ label, emoji, members, newMemberIds, accentColor }: RoomSectionProps) {
  if (members.length === 0) return null;

  // Sort: main session always first (desk #1), subagents after
  const sorted = [...members].sort((a, b) => {
    const aMain = Boolean(a.live?.isMain) || a.id === "you-main";
    const bMain = Boolean(b.live?.isMain) || b.id === "you-main";
    if (aMain && !bMain) return -1;
    if (!aMain && bMain) return 1;
    return 0;
  });

  const deskAssignments: Array<{
    config: DeskConfig;
    member: OfficeMember;
    status: DeskStatus;
  }> = sorted.map((member, index) => {
    const config: DeskConfig = {
      deskId: index + 1,
      label: member.name,
      agentKey: agentKeyForMember(member),
    };
    const status = inferDeskStatus(member);
    return { config, member, status };
  });

  return (
    <div
      style={{
        marginBottom: "16px",
        borderRadius: "4px",
        border: `1px solid ${accentColor}33`,
        background: `${accentColor}08`,
        overflow: "hidden",
      }}
    >
      {/* Room header */}
      <div
        style={{
          padding: "6px 10px",
          borderBottom: `1px solid ${accentColor}33`,
          background: `${accentColor}14`,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ fontSize: "11px" }}>{emoji}</span>
        <span
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: "9px",
            letterSpacing: "2px",
            color: accentColor,
            textTransform: "uppercase",
            fontWeight: "bold",
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "Courier New, monospace",
            fontSize: "8px",
            letterSpacing: "1px",
            color: `${accentColor}99`,
          }}
        >
          {members.length} AGENT{members.length !== 1 ? "S" : ""}
        </span>
      </div>

      {/* Desks */}
      <div className="pixel-office__grid" role="list" aria-label={`${label} desks`}>
        {deskAssignments.map(({ config, member, status }) => {
          const isNew = newMemberIds?.has(member.id);
          return (
            <div
              key={config.deskId}
              className={isNew ? "pixel-desk--fade-in" : undefined}
              style={isNew ? { animation: "fade-in 300ms ease forwards" } : undefined}
            >
              <Desk config={config} member={member} status={status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DeskGrid({ members, newMemberIds }: DeskGridProps) {
  const mainMembers = members.filter((m) => memberRoom(m) === "main");
  const communityMembers = members.filter((m) => memberRoom(m) === "community");

  const hasRooms = mainMembers.length > 0 && communityMembers.length > 0;

  // If only one room type exists, fall back to flat grid (no room headers needed)
  if (!hasRooms) {
    // Sort: main session always first, subagents after
    const sorted = [...members].sort((a, b) => {
      const aMain = Boolean(a.live?.isMain) || a.id === "you-main";
      const bMain = Boolean(b.live?.isMain) || b.id === "you-main";
      if (aMain && !bMain) return -1;
      if (!aMain && bMain) return 1;
      return 0;
    });

    const deskAssignments = sorted.map((member, index) => ({
      config: {
        deskId: index + 1,
        label: member.name,
        agentKey: agentKeyForMember(member),
      } as DeskConfig,
      member,
      status: inferDeskStatus(member),
    }));

    return (
      <div className="pixel-office__grid" role="list" aria-label="Agent desks">
        {deskAssignments.map(({ config, member, status }) => {
          const isNew = newMemberIds?.has(member.id);
          return (
            <div
              key={config.deskId}
              className={isNew ? "pixel-desk--fade-in" : undefined}
              style={isNew ? { animation: "fade-in 300ms ease forwards" } : undefined}
            >
              <Desk config={config} member={member} status={status} />
            </div>
          );
        })}
      </div>
    );
  }

  // Both rooms have members — render with room sections
  return (
    <div style={{ padding: "8px 0" }}>
      <RoomSection
        label="Main Room"
        emoji="🏠"
        members={mainMembers}
        newMemberIds={newMemberIds}
        accentColor="#00FF9F"
      />
      <RoomSection
        label="Community Room"
        emoji="🤖"
        members={communityMembers}
        newMemberIds={newMemberIds}
        accentColor="#A78BFA"
      />
    </div>
  );
}
