# Galaxy Command Center — Data Reality Fix

## Problem

The Galaxy Command Center has several issues the user identified:

1. **Hardcoded agents don't match reality** — Galaxy hardcodes `dev-agent, ops-agent, content-agent, tony-agent, community-bot, jarvis` as role IDs. But the REAL agents from `openclaw.json` are: `main` (Bob), `community`, `koko`, `jarvis`, `zozo`, `claude`. There is NO dev-agent, ops-agent, or content-agent as real agents — those are team structure ROLES, not agent instances.

2. **Agent list should come from openclaw.json** — The `agents.list[]` in openclaw.json defines 6 real agents. The Galaxy should read from the same source the API uses, and show these as the base planets.

3. **Working status not visually dramatic enough** — When an agent IS working (inferDeskStatus returns 'working'), the visual difference from idle needs to be unmistakable.

4. **Detail panel missing some fields** — Already partially fixed but need to verify completeness.

5. **Drag-to-reposition not implemented** — User wants to grab and move planets.

## Real Agent Configuration (from ~/.openclaw/openclaw.json)

```
main     → Bob (orchestrator/sun)
community → Community Bot  
koko     → Koko (was "tony-agent")
jarvis   → Jarvis
zozo     → Zozo Trader (MISSING from current Galaxy!)
claude   → Claude Code/ACP (was "dev-agent")
```

Also in agent dirs: `codex`, `gemini` (ACP harnesses)

Sessions appear as `agent:{agentId}:{context}:{uuid}` — e.g. `agent:main:main`, `agent:main:subagent:xyz`, `agent:community:telegram:direct`

## Changes

### 1. GalaxyCommandCenter.tsx — Use real agents from API, not hardcoded roles

**Current problem** (lines 301-303):
```typescript
const innerRoleIds = ['dev-agent', 'ops-agent', 'content-agent']
const outerRoleIds = ['tony-agent', 'community-bot', 'jarvis']
```

These don't match the real agent IDs from openclaw.json. The API's `matchSessionToRole()` tries to map sessions to these fake role IDs, which creates a mismatch.

**Fix**: Instead of hardcoding role IDs and using `matchSessionToRole()`, group sessions directly by their `agentId` from the rawKey. The agentId IS the real identifier — `main`, `community`, `koko`, `jarvis`, `zozo`, `claude`.

New logic:
```
1. Group all displayStates by agentId (from live.rawKey or live.agentId)
2. Bob (agentId='main', isMain=true) → sun at center
3. All other agentIds → planets on rings
4. Subagents (rawKey contains ':subagent:') → shown as smaller satellites near their parent agent
5. No synthetic placeholders needed — only show what's actually running
```

This means the planet count is dynamic — 0 planets when nothing is running (just the empty starfield), growing as agents come online.

**Files**: `src/components/galaxy-office/GalaxyCommandCenter.tsx`
- Remove `DEFAULT_ROLES`, `mergeWithDefaults()`, `matchToRole()` and all team-structure fetching
- Replace `orbitalAgents` useMemo with simple agentId-based grouping
- Remove `fetchStructure` and its polling interval
- Keep the orbital position calculator but make it work with dynamic agent count

### 2. GalaxyCommandCenter.tsx — Add drag-to-reposition

Add pointer event handling so any planet/sun/station can be dragged:

- `dragOffsets: Record<string, {dx: number, dy: number}>` state
- `onPointerDown` on each planet: record start position
- `onPointerMove` (on container): update element position directly via ref (no React re-render during drag for 60fps smoothness)  
- `onPointerUp`: commit offset to React state
- Final position = `orbitPosition + dragOffset`
- Bob draggable too — moving Bob moves the system center

**Files**: `src/components/galaxy-office/GalaxyCommandCenter.tsx`, `src/components/galaxy-office/AgentOrb.tsx` (add onPointerDown prop), `src/components/galaxy-office/BobSunOrb.tsx` (add onPointerDown prop)

### 3. Verify detail panel completeness

Already has: agent type, origin, uptime, last updated, currentCommand, progress bar, tokens, session ID, started, status detail, remove button.

**Still missing vs old PixelDesk**:
- Agent ID display (e.g. "main", "community") — add to header
- Model display needs to be more prominent

**Files**: `src/components/galaxy-office/GalaxyDetailPanel.tsx`

## Verification

1. Open `/digital-office?tab=classic`
2. If agents are running: planets appear for each active agent, working ones glow with energy ring + particles
3. If no agents running: just starfield + empty orbit rings (no fake idle planets)
4. Click planet → detail panel shows ALL fields from old PixelDesk
5. Drag any planet → it moves, orbit continues from new position
6. Drag Bob → entire system center moves
7. Zozo Trader agent should now appear when active (was missing before)
