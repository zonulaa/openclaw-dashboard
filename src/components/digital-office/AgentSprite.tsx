"use client";

import { getSpriteForKey } from "@/lib/office-sprites";
import type { DeskStatus } from "./Desk";

type AgentSpriteProps = {
  agentKey: string;
  status: DeskStatus;
  name?: string;
};

export function AgentSprite({ agentKey, status, name }: AgentSpriteProps) {
  const sprite = getSpriteForKey(agentKey);
  const { emoji, color, bgColor } = sprite;
  const displayName = name ?? sprite.name;

  return (
    <div
      className={`pixel-agent pixel-agent--${status}`}
      style={{ color }}
      aria-label={`${displayName} - ${status}`}
    >
      {/* Thought bubble (thinking state) */}
      {status === "thinking" && (
        <div className="pixel-agent__thought" aria-hidden="true">
          ...
        </div>
      )}

      {/* Head */}
      <div
        className="pixel-agent__head"
        style={{
          borderColor: color,
          background: bgColor,
        }}
        aria-hidden="true"
      >
        {emoji}
      </div>

      {/* Body with arms */}
      <div
        className="pixel-agent__body"
        style={{
          borderColor: color,
          background: bgColor,
        }}
        aria-hidden="true"
      >
        {/* Left arm */}
        <div
          className="pixel-agent__arm-left"
          style={{ background: color }}
        />
        {/* Right arm */}
        <div
          className="pixel-agent__arm-right"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}
