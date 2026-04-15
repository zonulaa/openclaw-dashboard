/**
 * team-session-matcher.ts
 *
 * Matches live digital-office members (sessions) to team roles.
 * Used by the Team Structure page to show which sessions are running
 * under each defined role.
 */

// ── Types ────────────────────────────────────────────────────────────

export type MatchableRole = {
  id: string
  title: string
  focus?: string
  responsibilities?: string[]
  agentId?: string
}

export type MatchableMember = {
  id: string
  name: string
  role: string
  workstation?: string
  live?: {
    sessionId: string
    runtime?: string
    model?: string
    parentSessionId?: string
    isMain: boolean
    uptimeMs?: number
    uptimeHuman?: string
    startedAt?: string
    agentId?: string
  }
  status?: string
  source?: 'live' | 'mock'
}

export type MatchResult = {
  /** roleId → matched session member ids */
  roleToMembers: Map<string, MatchableMember[]>
  /** memberId → matched roleId (or null if unassigned) */
  memberToRole: Map<string, string | null>
  /** members with no matched role */
  unassigned: MatchableMember[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract meaningful keywords from a role for matching.
 * Combines title words, focus words, and first words of responsibilities.
 */
function roleKeywords(role: MatchableRole): string[] {
  const words = new Set<string>()

  // Title words (e.g. "Developer Worker" → ["developer", "worker"])
  for (const word of normalize(role.title).split(' ')) {
    if (word.length > 2) words.add(word)
  }

  // Focus lane keywords
  if (role.focus) {
    for (const word of normalize(role.focus).split(' ')) {
      if (word.length > 3) words.add(word)
    }
  }

  // First keyword from each responsibility
  for (const resp of role.responsibilities || []) {
    const firstWord = normalize(resp).split(' ')[0]
    if (firstWord && firstWord.length > 3) words.add(firstWord)
  }

  return Array.from(words)
}

/**
 * Build a normalized text blob from a member for matching.
 */
function memberText(member: MatchableMember): string {
  return normalize(
    [
      member.name,
      member.role,
      member.workstation || '',
      member.live?.runtime || '',
    ].join(' '),
  )
}

/**
 * Score a member against a role (0 = no match, higher = better match).
 * Considers:
 * 1. Exact role title in member text
 * 2. Keyword overlap between role and member text
 * 3. Role field direct match
 */
function scoreMatch(member: MatchableMember, role: MatchableRole): number {
  let score = 0
  const text = memberText(member)
  const normTitle = normalize(role.title)

  // ── Hard agentId match (strongest signal) ────────────────────────
  // If the role declares an agentId, only members from that agent match.
  if (role.agentId) {
    const memberAgentId = member.live?.agentId ?? ''
    if (memberAgentId && memberAgentId === role.agentId) {
      score += 100
    } else if (memberAgentId && memberAgentId !== role.agentId) {
      // Wrong agent — hard reject
      return 0
    }
  }

  // Exact title match is strongest signal
  if (text.includes(normTitle)) {
    score += 10
  }

  // Member's role field matches role title or keywords
  const normMemberRole = normalize(member.role)
  if (normMemberRole.includes(normTitle) || normTitle.includes(normMemberRole)) {
    score += 6
  }

  // Keyword overlap
  const keywords = roleKeywords(role)
  for (const kw of keywords) {
    if (text.includes(kw)) score += 1
  }

  // Main session always matches a "lead"/"orchestrator" role
  if (member.live?.isMain && (normTitle.includes('lead') || normTitle.includes('orchestrator'))) {
    score += 8
  }

  // Worker sessions match worker roles
  if (
    !member.live?.isMain &&
    member.live?.parentSessionId &&
    role.id !== 'lead-orchestrator' &&
    !normTitle.includes('lead')
  ) {
    score += 2
  }

  return score
}

// ── Main export ───────────────────────────────────────────────────────

/**
 * Match live session members to team roles.
 *
 * Strategy:
 * - For each member, score against every role
 * - Assign to the highest-scoring role (if score > 0)
 * - Members with score 0 go to unassigned
 * - Mock members with no live data are skipped from unassigned (not useful)
 *
 * @param roles  - Team roles from /api/team-structure
 * @param members - Live members from /api/digital-office
 */
export function matchSessionsToRoles(
  roles: MatchableRole[],
  members: MatchableMember[],
): MatchResult {
  const roleToMembers = new Map<string, MatchableMember[]>()
  const memberToRole = new Map<string, string | null>()
  const unassigned: MatchableMember[] = []

  // Initialize map for all roles
  for (const role of roles) {
    roleToMembers.set(role.id, [])
  }

  for (const member of members) {
    // Skip pure mock members with no live session from unassigned display
    // (they appear when RPC is unavailable — showing them as unassigned is noisy)
    const isMockOnly = member.source === 'mock' && !member.live

    if (isMockOnly) {
      memberToRole.set(member.id, null)
      continue
    }

    let bestRoleId: string | null = null
    let bestScore = 0

    for (const role of roles) {
      const score = scoreMatch(member, role)
      if (score > bestScore) {
        bestScore = score
        bestRoleId = role.id
      }
    }

    memberToRole.set(member.id, bestRoleId)

    if (bestRoleId && bestScore > 0) {
      const list = roleToMembers.get(bestRoleId) ?? []
      list.push(member)
      roleToMembers.set(bestRoleId, list)
    } else {
      unassigned.push(member)
    }
  }

  return { roleToMembers, memberToRole, unassigned }
}
