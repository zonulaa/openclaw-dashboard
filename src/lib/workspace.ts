import path from 'node:path'

export function getWorkspaceRoot(): string {
  const configured = process.env.OPENCLAW_WORKSPACE_ROOT?.trim()
  if (configured) return configured
  return path.resolve(process.cwd(), '..')
}

export function getMemoryRoot(): string {
  return path.join(getWorkspaceRoot(), 'memory')
}
