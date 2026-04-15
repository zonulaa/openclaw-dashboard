"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ─────────────────────────────────────────────────────────────

interface DailyItem {
  id: string;
  text: string;
  done: boolean;
  fromTaskId?: string;   // if pulled from task board subtask
  fromParentId?: string; // parent task id it came from
}

interface Subtask {
  id: string;
  title?: string; // some tasks use 'title'
  text?: string;  // task-board.json uses 'text'
  done: boolean;
}

interface ParentTask {
  id: string;
  title: string;
  status?: string;
  subtasks?: Subtask[];
}

function subtaskLabel(s: Subtask): string {
  return s.title ?? s.text ?? "(untitled)";
}

// ── API helpers ───────────────────────────────────────────────────────

async function loadDailyItems(): Promise<DailyItem[]> {
  try {
    const r = await fetch("/api/daily-focus/scratch", { cache: "no-store" });
    const d = await r.json() as { items: DailyItem[] };
    return d.items ?? [];
  } catch { return []; }
}

async function loadParentTasks(): Promise<ParentTask[]> {
  try {
    const r = await fetch("/api/task-board", { cache: "no-store" });
    const d = await r.json() as { tasks?: ParentTask[] };
    return d.tasks ?? [];
  } catch { return []; }
}

async function apiPost(text: string): Promise<DailyItem | null> {
  try {
    const r = await fetch("/api/daily-focus/scratch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return r.json() as Promise<DailyItem>;
  } catch { return null; }
}

async function apiDelete(id: string) {
  await fetch(`/api/daily-focus/scratch?id=${id}`, { method: "DELETE" });
}

async function apiToggle(id: string, done: boolean) {
  await fetch("/api/daily-focus/scratch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, done }),
  });
}

async function apiReorder(items: DailyItem[]) {
  await fetch("/api/daily-focus/scratch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

async function apiEdit(id: string, text: string) {
  await fetch("/api/daily-focus/scratch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text }),
  });
}

async function apiAddSubtask(taskId: string, text: string) {
  // Fetch current task, then PATCH with new subtask appended
  const r = await fetch(`/api/task-board/${taskId}`);
  if (!r.ok) return;
  const task = await r.json() as ParentTask;
  const existing: Subtask[] = task.subtasks ?? [];
  const newSub = { id: `sub-${Date.now()}`, text, done: false };
  await fetch(`/api/task-board/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subtasks: [...existing, newSub] }),
  });
}

// ── Modals ────────────────────────────────────────────────────────────

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    />
  );
}

// Modal: pick subtasks from all parent tasks
function PickSubtasksModal({
  parents,
  onClose,
  onAdd,
}: {
  parents: ParentTask[];
  onClose: () => void;
  onAdd: (items: { text: string; fromTaskId: string; fromParentId: string }[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, { text: string; parentId: string; parentTitle: string }>>({});

  const toggle = (key: string, text: string, parentId: string, parentTitle: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { text, parentId, parentTitle };
      return next;
    });
  };

  const confirm = () => {
    const items = Object.entries(selected).map(([key, v]) => ({
      text: v.text,
      fromTaskId: key,
      fromParentId: v.parentId,
    }));
    onAdd(items);
    onClose();
  };

  const count = Object.keys(selected).length;

  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 51, width: "min(480px, 92vw)", maxHeight: "70vh",
        background: "#0a0e1f", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem" }}>Pick subtasks to add today</span>
          <button onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0.75rem 1.25rem" }}>
          {parents.filter(p => p.subtasks && p.subtasks.length > 0).map((parent) => (
            <div key={parent.id} style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
                {parent.title}
              </div>
              {(parent.subtasks ?? []).filter(s => !s.done).map((sub) => {
                const key = `${parent.id}::${sub.id}`;
                const isSelected = !!selected[key];
                const label = subtaskLabel(sub);
                return (
                  <div
                    key={sub.id}
                    onClick={() => toggle(key, label, parent.id, parent.title)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.6rem",
                      padding: "0.45rem 0.6rem", borderRadius: 8, cursor: "pointer",
                      background: isSelected ? "rgba(56,189,248,0.12)" : "transparent",
                      border: isSelected ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent",
                      marginBottom: "0.2rem", transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: isSelected ? "none" : "2px solid #475569",
                      background: isSelected ? "#38bdf8" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && <span style={{ color: "#0f172a", fontSize: "0.65rem", fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: isSelected ? "#e2e8f0" : "#94a3b8" }}>{label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {parents.every(p => !p.subtasks || p.subtasks.length === 0) && (
            <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>No subtasks found</p>
          )}
        </div>
        <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={confirm}
            disabled={count === 0}
            style={{
              width: "100%", padding: "0.65rem", borderRadius: 10, border: "none", cursor: count > 0 ? "pointer" : "not-allowed",
              background: count > 0 ? "#38bdf8" : "#1e293b", color: count > 0 ? "#0f172a" : "#475569",
              fontWeight: 700, fontSize: "0.9rem", transition: "all 0.15s",
            }}
          >
            {count > 0 ? `Add ${count} item${count > 1 ? "s" : ""} to today` : "Select subtasks"}
          </button>
        </div>
      </div>
    </>
  );
}

// Modal: pick which parent task to add this item to
function AddToTaskModal({
  item,
  parents,
  onClose,
  onAdd,
}: {
  item: DailyItem;
  parents: ParentTask[];
  onClose: () => void;
  onAdd: (parentId: string) => void;
}) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 51, width: "min(400px, 92vw)",
        background: "#0a0e1f", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, overflow: "hidden",
      }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.95rem" }}>Add to task board</span>
          <button onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
        </div>
        <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>"{item.text}"</p>
        </div>
        <div style={{ padding: "0.75rem 1rem", maxHeight: "50vh", overflowY: "auto" }}>
          <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Choose parent task</p>
          {parents.map((parent) => (
            <div
              key={parent.id}
              onClick={() => { onAdd(parent.id); onClose(); }}
              style={{
                padding: "0.65rem 0.8rem", borderRadius: 10, cursor: "pointer",
                marginBottom: "0.3rem", border: "1px solid rgba(255,255,255,0.06)",
                color: "#cbd5e1", fontSize: "0.88rem", fontWeight: 500,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {parent.title}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Sortable Row ──────────────────────────────────────────────────────

function SortableRow({
  item,
  onDelete,
  onToggle,
  onAddToBoard,
  onEdit,
}: {
  item: DailyItem;
  onDelete: (id: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onAddToBoard: (item: DailyItem) => void;
  onEdit: (id: string, text: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(item.text);
  const editRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (item.done) return;
    setEditVal(item.text);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== item.text) onEdit(item.id, trimmed);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.4rem 0.5rem", borderRadius: 10,
        background: editing ? "rgba(56,189,248,0.05)" : isDragging ? "rgba(56,189,248,0.06)" : "transparent",
        border: editing ? "1px solid rgba(56,189,248,0.2)" : "1px solid transparent",
        marginBottom: "0.15rem",
      }}
      className="group"
    >
      {/* drag handle — hide while editing */}
      {!editing && (
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "#334155", fontSize: "0.9rem", userSelect: "none", flexShrink: 0 }}
          className="hover:!text-slate-400"
        >
          ⠿
        </span>
      )}

      {/* checkbox */}
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => onToggle(item.id, !item.done)}
        style={{ width: 15, height: 15, accentColor: "#38bdf8", cursor: "pointer", flexShrink: 0 }}
      />

      {/* text / inline edit */}
      {editing ? (
        <input
          ref={editRef}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commitEdit}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.4,
          }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          style={{
            flex: 1, fontSize: "0.88rem", lineHeight: 1.4,
            color: item.done ? "#475569" : "#cbd5e1",
            textDecoration: item.done ? "line-through" : "none",
            cursor: item.done ? "default" : "text",
          }}
          title={item.done ? "" : "Double-click to edit"}
        >
          {item.text}
          {item.fromParentId && (
            <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#38bdf8", opacity: 0.7 }}>
              ↑ task
            </span>
          )}
        </span>
      )}

      {/* actions */}
      {!editing && (
        <div style={{ display: "flex", gap: "0.3rem", opacity: 0, transition: "opacity 0.15s" }} className="group-hover:!opacity-100">
          {!item.fromParentId && (
            <button
              onClick={() => onAddToBoard(item)}
              title="Add to task board"
              style={{
                fontSize: "0.7rem", padding: "0.2rem 0.45rem", borderRadius: 6,
                border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.08)",
                color: "#38bdf8", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              → Board
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            title="Remove"
            style={{
              fontSize: "0.75rem", padding: "0.2rem 0.4rem", borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.2)", background: "transparent",
              color: "#f87171", cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function DailyFocusContent() {
  const [items, setItems] = useState<DailyItem[]>([]);
  const [parents, setParents] = useState<ParentTask[]>([]);
  const [input, setInput] = useState("");
  const [showPickModal, setShowPickModal] = useState(false);
  const [addToBoardItem, setAddToBoardItem] = useState<DailyItem | null>(null);
  const [addedToBoard, setAddedToBoard] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load items + tasks
  useEffect(() => {
    void loadDailyItems().then(setItems);
    void loadParentTasks().then(setParents);
  }, []);

  // Add item
  const handleAdd = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const newItem = await apiPost(text);
    if (newItem) setItems((prev) => [...prev, newItem]);
    inputRef.current?.focus();
  };

  // Pull subtasks from task board into daily list
  const handlePickSubtasks = async (picked: { text: string; fromTaskId: string; fromParentId: string }[]) => {
    const added: DailyItem[] = [];
    for (const p of picked) {
      const newItem = await apiPost(p.text);
      if (newItem) added.push(newItem);
    }
    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
    }
  };

  // Add daily item as subtask to a parent task
  const handleAddToBoard = async (parentId: string) => {
    if (!addToBoardItem) return;
    await apiAddSubtask(parentId, addToBoardItem.text);
    setAddedToBoard(parentId);
    setTimeout(() => setAddedToBoard(null), 2500);
  };

  // Toggle done
  const handleToggle = async (id: string, done: boolean) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, done } : i));
    await apiToggle(id, done);
  };

  // Delete
  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await apiDelete(id);
  };

  // Inline edit
  const handleEdit = async (id: string, text: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
    await apiEdit(id, text);
  };

  // Drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    await apiReorder(reordered);
  };

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Today's Focus</h1>
        <p style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "0.25rem" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Jakarta" })}
          {items.length > 0 && (
            <span style={{ marginLeft: "0.75rem", color: doneCount === items.length ? "#4ade80" : "#38bdf8" }}>
              {doneCount}/{items.length} done
            </span>
          )}
        </p>
      </div>

      {/* Main card */}
      <div style={{
        background: "#12121f", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", flex: 1 }}>
            📋 DAILY LIST
          </span>
          <button
            onClick={() => setShowPickModal(true)}
            style={{
              fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: 8,
              border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.08)",
              color: "#38bdf8", cursor: "pointer", fontWeight: 600,
            }}
          >
            + From Tasks
          </button>
        </div>

        {/* Items list */}
        <div style={{ padding: "0.5rem 0.75rem", minHeight: 60 }}>
          {items.length === 0 ? (
            <p style={{ color: "#334155", fontSize: "0.82rem", padding: "0.75rem 0.25rem" }}>
              No items yet — add one below or pull from task board
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onAddToBoard={(i) => setAddToBoardItem(i)}
                    onEdit={handleEdit}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Quick add */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.65rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            placeholder="Add item… (Enter)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "0.88rem", color: "#cbd5e1",
            }}
          />
          <button
            onClick={() => void handleAdd()}
            disabled={!input.trim()}
            style={{
              fontSize: "1.1rem", color: input.trim() ? "#38bdf8" : "#334155",
              background: "none", border: "none", cursor: input.trim() ? "pointer" : "default",
              lineHeight: 1, transition: "color 0.15s",
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Added to board toast */}
      {addedToBoard && (
        <div style={{
          position: "fixed", bottom: "5rem", left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", border: "1px solid rgba(74,222,128,0.3)",
          color: "#4ade80", padding: "0.6rem 1.2rem", borderRadius: 10,
          fontSize: "0.82rem", fontWeight: 600, zIndex: 100,
        }}>
          ✓ Added to task board
        </div>
      )}

      {/* Modals */}
      {showPickModal && (
        <PickSubtasksModal
          parents={parents}
          onClose={() => setShowPickModal(false)}
          onAdd={handlePickSubtasks}
        />
      )}
      {addToBoardItem && (
        <AddToTaskModal
          item={addToBoardItem}
          parents={parents}
          onClose={() => setAddToBoardItem(null)}
          onAdd={handleAddToBoard}
        />
      )}
    </div>
  );
}
