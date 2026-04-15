// Emoji-based sprite definitions for 5 main agents + subagents

export type AgentSpriteDefinition = {
  key: string;           // agent key prefix
  name: string;          // display name
  emoji: string;         // head emoji
  bodyEmoji: string;     // body/body emoji
  color: string;         // primary color
  bgColor: string;       // transparent background (hex + alpha)
  description: string;   // short blurb
};

export const AGENT_SPRITES: AgentSpriteDefinition[] = [
  {
    key: "agent:main:main",
    name: "Main",
    emoji: "🐶",
    bodyEmoji: "💼",
    color: "#FF6B6B",
    bgColor: "#FF6B6B22",
    description: "Lead Orchestrator",
  },
  {
    key: "agent:agent1",
    name: "Agent1",
    emoji: "🤖",
    bodyEmoji: "⚙️",
    color: "#FFE66D",
    bgColor: "#FFE66D22",
    description: "Automation Worker",
  },
  {
    key: "agent:claude",
    name: "Claude",
    emoji: "🧠",
    bodyEmoji: "📚",
    color: "#A8E6CF",
    bgColor: "#A8E6CF22",
    description: "Intelligence Engine",
  },
  {
    key: "agent:codex",
    name: "Codex",
    emoji: "💻",
    bodyEmoji: "🔧",
    color: "#FF8B94",
    bgColor: "#FF8B9422",
    description: "Code Specialist",
  },
  {
    key: "agent:gemini",
    name: "Gemini",
    emoji: "✨",
    bodyEmoji: "🌟",
    color: "#95E1D3",
    bgColor: "#95E1D322",
    description: "Multi-modal Agent",
  },
  {
    key: "subagent",
    name: "Subagent",
    emoji: "⚡",
    bodyEmoji: "🔌",
    color: "#4ECDC4",
    bgColor: "#4ECDC422",
    description: "Spawned Worker",
  },
];

export const AGENT_COLOR_MAP: Record<string, string> = Object.fromEntries(
  AGENT_SPRITES.map((s) => [s.key, s.color])
);

export const AGENT_EMOJI_MAP: Record<string, string> = Object.fromEntries(
  AGENT_SPRITES.map((s) => [s.key, s.emoji])
);

export function getSpriteForKey(agentKey: string): AgentSpriteDefinition {
  // Exact match first
  const exact = AGENT_SPRITES.find((s) => s.key === agentKey);
  if (exact) return exact;

  // Prefix match
  const prefix = AGENT_SPRITES.find((s) => agentKey.startsWith(s.key + ":") || agentKey.startsWith(s.key));
  if (prefix) return prefix;

  // Fallback: subagent
  return AGENT_SPRITES[AGENT_SPRITES.length - 1];
}
