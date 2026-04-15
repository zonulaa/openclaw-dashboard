"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────
export interface HierarchyRole {
  id: string;
  title: string;
  ownerType: "me" | "worker";
  focus: string;
  parentId?: string | null;
  subAgents?: string[];
}

export interface HierarchyTreeProps {
  roles: HierarchyRole[];
  /** Set of role IDs that have a live session */
  liveRoleIds: Set<string>;
}

interface TreeNode {
  role: HierarchyRole;
  children: TreeNode[];
}

// ── CSS ──────────────────────────────────────────────────────────────
const HIERARCHY_CSS = `
@keyframes hierarchy-dot-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(34,197,94,0.6); }
  50%       { opacity: 0.6; box-shadow: 0 0 8px rgba(34,197,94,0.9); }
}

.hierarchy-section {
  background: linear-gradient(180deg, rgba(8,12,30,0.555), rgba(20,20,40,0.9));
  border: 1px solid rgba(0,212,255,0.12);
  border-radius: 12px;
  overflow: hidden;
}

.hierarchy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease;
}

.hierarchy-header:hover {
  background: rgba(0,212,255,0.06);
}

.hierarchy-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hierarchy-header-title {
  color: #e2e8f0;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.hierarchy-header-badge {
  color: #5e7299;
  font-size: 0.65rem;
  background: rgba(0,212,255,0.09);
  border: 1px solid rgba(55,55,80,0.6);
  border-radius: 9999px;
  padding: 1px 8px;
}

.hierarchy-chevron {
  color: #5e7299;
  font-size: 0.7rem;
  transition: transform 200ms ease;
}

.hierarchy-chevron-open {
  transform: rotate(90deg);
}

.hierarchy-body {
  padding: 4px 16px 16px;
}

.hierarchy-tree {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Node ── */
.hierarchy-node {
  position: relative;
}

.hierarchy-node-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: default;
  transition: background 120ms ease;
}

.hierarchy-node-row:hover {
  background: rgba(0,212,255,0.08);
}

.hierarchy-node-row-expandable {
  cursor: pointer;
}

/* Status dot */
.hierarchy-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hierarchy-dot-live {
  background: #22c55e;
  box-shadow: 0 0 4px rgba(34,197,94,0.6);
  animation: hierarchy-dot-pulse 2s ease-in-out infinite;
}

.hierarchy-dot-idle {
  background: #3a4e70;
  box-shadow: none;
}

/* Title & focus */
.hierarchy-node-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.hierarchy-node-title {
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hierarchy-node-title-owner {
  color: #fbbf24;
}

.hierarchy-node-focus {
  color: #5e7299;
  font-size: 0.66rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sub-agents chip */
.hierarchy-sub-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0,212,255,0.06);
  border: 1px solid rgba(0,212,255,0.18);
  border-radius: 9999px;
  padding: 2px 8px;
  color: #77adff;
  font-size: 0.6rem;
  font-weight: 500;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
  user-select: none;
}

.hierarchy-sub-chip:hover {
  background: rgba(0,212,255,0.1);
  border-color: rgba(0,212,255,0.3);
}

.hierarchy-sub-chip-arrow {
  transition: transform 200ms ease;
  font-size: 0.55rem;
}

.hierarchy-sub-chip-arrow-open {
  transform: rotate(90deg);
}

/* Children container */
.hierarchy-children {
  margin-left: 20px;
  padding-left: 14px;
  border-left: 1px solid rgba(55,55,80,0.5);
}

/* Sub-agents list */
.hierarchy-sub-agents {
  margin-left: 20px;
  padding-left: 14px;
  border-left: 1px dashed rgba(0,212,255,0.18);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.hierarchy-sub-agent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  transition: background 120ms ease;
}

.hierarchy-sub-agent-row:hover {
  background: rgba(37,37,64,0.35);
}

.hierarchy-sub-agent-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2a3a55;
  flex-shrink: 0;
}

.hierarchy-sub-agent-name {
  color: #6880a8;
  font-size: 0.66rem;
  font-family: "Courier New", monospace;
}
`;

// ── Build tree from flat roles ───────────────────────────────────────
function buildTree(roles: HierarchyRole[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const role of roles) {
    nodeMap.set(role.id, { role, children: [] });
  }

  // Link children
  for (const role of roles) {
    const node = nodeMap.get(role.id)!;
    if (role.parentId && nodeMap.has(role.parentId)) {
      nodeMap.get(role.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Tree node component ──────────────────────────────────────────────
function HierarchyNodeRow({
  node,
  liveRoleIds,
  depth,
}: {
  node: TreeNode;
  liveRoleIds: Set<string>;
  depth: number;
}) {
  const [childrenExpanded, setChildrenExpanded] = useState(depth < 2);
  const [subAgentsExpanded, setSubAgentsExpanded] = useState(false);

  const hasChildren = node.children.length > 0;
  const hasSubAgents = (node.role.subAgents?.length ?? 0) > 0;
  const isLive = liveRoleIds.has(node.role.id);
  const isOwner = node.role.ownerType === "me";

  const handleRowClick = useCallback(() => {
    if (hasChildren) {
      setChildrenExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const handleSubChipClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSubAgentsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="hierarchy-node">
      <div
        className={`hierarchy-node-row ${hasChildren ? "hierarchy-node-row-expandable" : ""}`}
        onClick={handleRowClick}
        role={hasChildren ? "button" : undefined}
        aria-expanded={hasChildren ? childrenExpanded : undefined}
      >
        {/* Expand indicator for nodes with children */}
        {hasChildren && (
          <span
            className={`hierarchy-chevron ${childrenExpanded ? "hierarchy-chevron-open" : ""}`}
            aria-hidden="true"
          >
            ▶
          </span>
        )}

        {/* Status dot */}
        <span
          className={`hierarchy-dot ${isLive ? "hierarchy-dot-live" : "hierarchy-dot-idle"}`}
          title={isLive ? "Live session active" : "Idle"}
          aria-label={isLive ? "Active" : "Idle"}
        />

        {/* Title + focus */}
        <div className="hierarchy-node-info">
          <span
            className={`hierarchy-node-title ${isOwner ? "hierarchy-node-title-owner" : ""}`}
          >
            {node.role.title}
          </span>
          <span className="hierarchy-node-focus">{node.role.focus}</span>
        </div>

        {/* Sub-agents chip */}
        {hasSubAgents && (
          <span
            className="hierarchy-sub-chip"
            onClick={handleSubChipClick}
            role="button"
            aria-expanded={subAgentsExpanded}
            title={`${node.role.subAgents!.length} sub-agents`}
          >
            <span
              className={`hierarchy-sub-chip-arrow ${subAgentsExpanded ? "hierarchy-sub-chip-arrow-open" : ""}`}
              aria-hidden="true"
            >
              ▶
            </span>
            {node.role.subAgents!.length} sub-agents
          </span>
        )}
      </div>

      {/* Sub-agents expanded list */}
      {hasSubAgents && subAgentsExpanded && (
        <div className="hierarchy-sub-agents">
          {node.role.subAgents!.map((sa) => (
            <div key={sa} className="hierarchy-sub-agent-row">
              <span className="hierarchy-sub-agent-dot" aria-hidden="true" />
              <span className="hierarchy-sub-agent-name">{sa}</span>
            </div>
          ))}
        </div>
      )}

      {/* Children nodes */}
      {hasChildren && childrenExpanded && (
        <div className="hierarchy-children">
          {node.children.map((child) => (
            <HierarchyNodeRow
              key={child.role.id}
              node={child}
              liveRoleIds={liveRoleIds}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export function HierarchyTree({ roles, liveRoleIds }: HierarchyTreeProps) {
  const [collapsed, setCollapsed] = useState(false);

  const tree = useMemo(() => buildTree(roles), [roles]);
  const liveCount = liveRoleIds.size;
  const totalCount = roles.filter((r) => r.ownerType === "worker").length;

  return (
    <>
      <style>{HIERARCHY_CSS}</style>
      <section className="hierarchy-section" aria-label="Agent hierarchy">
        {/* Header (click to collapse/expand) */}
        <div
          className="hierarchy-header"
          onClick={() => setCollapsed((prev) => !prev)}
          role="button"
          aria-expanded={!collapsed}
        >
          <div className="hierarchy-header-left">
            <span
              className={`hierarchy-chevron ${!collapsed ? "hierarchy-chevron-open" : ""}`}
              aria-hidden="true"
            >
              ▶
            </span>
            <span className="hierarchy-header-title">🏢 Org Hierarchy</span>
            <span className="hierarchy-header-badge">
              {liveCount}/{totalCount} active
            </span>
          </div>
        </div>

        {/* Body */}
        {!collapsed && (
          <div className="hierarchy-body">
            <div className="hierarchy-tree">
              {tree.map((root) => (
                <HierarchyNodeRow
                  key={root.role.id}
                  node={root}
                  liveRoleIds={liveRoleIds}
                  depth={0}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
