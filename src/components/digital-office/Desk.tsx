"use client";

import { useState, useCallback } from "react";
import type { OfficeMember } from "@/lib/digital-office-live";
import { AgentSprite } from "./AgentSprite";
import { StatusBar } from "./StatusBar";
import { getSpriteForKey } from "@/lib/office-sprites";

export type DeskStatus = "working" | "idle" | "thinking" | "empty";

export type DeskConfig = {
  deskId: number;
  label: string;
  agentKey: string;
};

export type DeskProps = {
  config: DeskConfig;
  member?: OfficeMember | null;
  status: DeskStatus;
};

function getAgentName(member: OfficeMember, agentKey: string): string {
  if (member.name) return member.name;
  const sprite = getSpriteForKey(agentKey);
  return sprite.name;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function getStatusColor(status: DeskStatus): string {
  switch (status) {
    case "working": return "#FF6B6B";
    case "idle": return "#FFE66D";
    case "thinking": return "#A8E6CF";
    case "empty": return "#4a4a7a";
  }
}

function getModelShort(member: OfficeMember): string {
  const raw = member.live?.model ?? member.workstation?.replace("Runtime • ", "") ?? "";
  if (!raw || raw === "default-model") return "—";
  // Shorten model names for display
  return raw
    .replace("anthropic/", "")
    .replace("claude-", "cl-")
    .replace("sonnet-4-5", "s4.5")
    .replace("haiku-4-5", "h4.5")
    .replace("opus-4", "o4")
    .slice(0, 16);
}

export function Desk({ config, member, status }: DeskProps) {
  const sprite = getSpriteForKey(config.agentKey);
  const { color } = sprite;
  const agentName = member ? getAgentName(member, config.agentKey) : null;
  const modelShort = member ? getModelShort(member) : null;
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const handleMouseEnter = useCallback(() => setTooltipVisible(true), []);
  const handleMouseLeave = useCallback(() => setTooltipVisible(false), []);

  return (
    <div
      className={`pixel-desk pixel-desk--${status}`}
      role="article"
      aria-label={`Desk ${config.deskId}: ${config.label} — ${status}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Desk number */}
      <span className="pixel-desk__number">#{config.deskId}</span>

      {/* Tooltip */}
      {member && tooltipVisible && (
        <div
          className="pixel-tooltip"
          role="tooltip"
          style={{ opacity: 1, pointerEvents: "none" }}
        >
          <div className="pixel-tooltip__row">
            <span className="pixel-tooltip__key">SESSION</span>
            <span className="pixel-tooltip__value">
              {truncate(member.live?.sessionId ?? "—", 18)}
            </span>
          </div>
          <div className="pixel-tooltip__row">
            <span className="pixel-tooltip__key">MODEL</span>
            <span className="pixel-tooltip__value">
              {member.live?.model ?? member.workstation?.replace("Runtime • ", "") ?? "—"}
            </span>
          </div>
          <div className="pixel-tooltip__row">
            <span className="pixel-tooltip__key">UPTIME</span>
            <span className="pixel-tooltip__value">
              {member.live?.uptimeHuman ?? "—"}
            </span>
          </div>
          <div className="pixel-tooltip__row">
            <span className="pixel-tooltip__key">ROLE</span>
            <span className="pixel-tooltip__value">{truncate(member.role ?? "—", 18)}</span>
          </div>
          <div className="pixel-tooltip__row">
            <span className="pixel-tooltip__key">STATUS</span>
            <span className="pixel-tooltip__value" style={{ color: getStatusColor(status) }}>
              {status.toUpperCase()}
            </span>
          </div>
          {member.statusDetail && (
            <div className="pixel-tooltip__row">
              <span className="pixel-tooltip__key">DETAIL</span>
              <span className="pixel-tooltip__value">{truncate(member.statusDetail, 22)}</span>
            </div>
          )}
          {member.live?.updatedAt && (
            <div className="pixel-tooltip__row">
              <span className="pixel-tooltip__key">UPDATED</span>
              <span className="pixel-tooltip__value">
                {new Date(member.live.updatedAt).toLocaleTimeString("en-US", { hour12: false })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Agent sprite or empty chair */}
      {member ? (
        <AgentSprite
          agentKey={config.agentKey}
          status={status}
          name={agentName ?? undefined}
        />
      ) : (
        <div className="pixel-desk__empty-label" aria-label="Available desk">
          <span aria-hidden="true">🪑</span>
          <br />
          available
        </div>
      )}

      {/* Agent name + model */}
      {member && agentName && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", width: "100%" }}>
          <div className="pixel-desk__agent-name" style={{ color }}>
            {truncate(agentName, 20)}
          </div>
          {modelShort && modelShort !== "—" && (
            <div
              style={{
                fontSize: "8px",
                color: "#4a4a7a",
                fontFamily: "Courier New, monospace",
                letterSpacing: "0",
              }}
            >
              [{modelShort}]
            </div>
          )}
        </div>
      )}

      {/* Status badge */}
      <StatusBar status={status} />

      {/* Desk surface */}
      <div
        className="pixel-desk__surface"
        style={{ background: member ? "#8B7355" : "#4a4040" }}
        aria-hidden="true"
      />

      {/* Chair */}
      <div className="pixel-desk__chair" aria-hidden="true" />

      {/* Progress bar for working agents */}
      {status === "working" && (
        <div className="pixel-progress" role="progressbar" aria-label="Working progress">
          <div
            className="pixel-progress__fill"
            style={{
              width: member?.live?.uptimeMs
                ? `${Math.min(100, (member.live.uptimeMs / 600_000) * 100)}%`
                : "60%",
            }}
          />
        </div>
      )}
    </div>
  );
}
