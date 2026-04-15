"use client";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";

// ── Types (mirrored from parent to avoid circular imports) ────────────────────

export type SubtaskItem = { id: string; text: string; done: boolean };

// ── Single sortable subtask row ───────────────────────────────────────────────

function SortableSubtaskRow({
  sub,
  accentColor,
  isMobile,
  selectMode,
  isSelected,
  editingId,
  onToggle,
  onSelectToggle,
  onEditConfirm,
  onEditStart,
}: {
  sub: SubtaskItem;
  accentColor: string;
  isMobile: boolean;
  selectMode: boolean;
  isSelected: boolean;
  editingId: string | null;
  onToggle: (id: string) => void;
  onSelectToggle: (id: string) => void;
  onEditConfirm: (id: string, text: string) => void;
  onEditStart: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sub.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isUser = sub.text.includes("[User]");
  const displayText = sub.text.replace(/\[User\]\s*/g, "").trim();
  const isEditing = editingId === sub.id;

  const [editValue, setEditValue] = useState(displayText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(displayText);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, displayText]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md px-2 py-1.5 group"
      data-subtask-row="true"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing"
        style={{
          background: "none",
          border: "none",
          padding: "0 2px",
          color: "#5e7299",
          fontSize: "12px",
          opacity: isMobile ? 1 : 0,
          lineHeight: 1,
          transition: "opacity 0.15s",
        }}
        // On desktop make it visible on group-hover via inline style swap
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = isMobile ? "1" : "0"; }}
      >
        ⠿
      </button>

      {/* Checkbox (normal mode) or select checkbox */}
      {selectMode ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelectToggle(sub.id)}
          style={{ marginTop: "2px", flexShrink: 0, accentColor }}
        />
      ) : (
        <input
          type="checkbox"
          checked={sub.done}
          onChange={() => onToggle(sub.id)}
          style={{ marginTop: "2px", flexShrink: 0, accentColor: isUser ? "#f97316" : accentColor }}
        />
      )}

      {/* Text or inline edit */}
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditConfirm(sub.id, editValue);
              if (e.key === "Escape") onEditConfirm(sub.id, displayText); // cancel
            }}
            className="flex-1 px-2 py-0.5 text-xs outline-none rounded"
            style={{
              background: "rgba(5,5,16,0.9)",
              border: "1px solid rgba(96,165,250,0.4)",
              color: "#c8deff",
              minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={() => onEditConfirm(sub.id, editValue)}
            style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", fontSize: "12px" }}
          >
            ✓
          </button>
        </div>
      ) : (
        <span
          className="text-xs leading-relaxed flex-1"
          style={{
            color: sub.done ? "#4b5563" : isUser ? "#fed7aa" : "#c8d8f0",
            textDecoration: sub.done ? "line-through" : "none",
            cursor: selectMode ? "pointer" : "default",
          }}
          onClick={() => selectMode && onSelectToggle(sub.id)}
          onDoubleClick={() => !selectMode && !isUser && onEditStart(sub.id)}
          title={!selectMode && !isUser ? "Double-click to edit" : undefined}
        >
          {isUser && !sub.done && (
            <span style={{ color: "#f97316", fontWeight: 700, marginRight: 4 }}>[LO]</span>
          )}
          {displayText}
        </span>
      )}
    </div>
  );
}

// ── SubtaskList ───────────────────────────────────────────────────────────────

export function SubtaskList({
  subtasks,
  accentColor,
  isMobile,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
  onOpenUI,
  onCloseUI,
}: {
  subtasks: SubtaskItem[];
  accentColor: string;
  isMobile: boolean;
  onReorder: (subtasks: SubtaskItem[]) => void;
  onToggle: (subtaskId: string) => void;
  onDelete: (ids: Set<string>) => void;
  onEdit: (subtaskId: string, newText: string) => void;
  onOpenUI: () => void;
  onCloseUI: () => void;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelected(new Set());
    onOpenUI();
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    onCloseUI();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = [...subtasks];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next);
  };

  const handleDelete = () => {
    onDelete(selected);
    exitSelectMode();
  };

  const handleEditStart = (id: string) => {
    setEditingId(id);
    onOpenUI();
  };

  const handleEditConfirm = (id: string, text: string) => {
    onEdit(id, text);
    setEditingId(null);
    onCloseUI();
  };

  if (subtasks.length === 0) return null;

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[0.62rem] font-semibold uppercase tracking-wide" style={{ color: "#5e7299" }}>
          Subtasks
        </span>
        <button
          type="button"
          onClick={selectMode ? exitSelectMode : enterSelectMode}
          style={{
            background: "none",
            border: "1px solid rgba(148,163,184,0.25)",
            color: selectMode ? "#f87171" : "#64748b",
            borderRadius: "6px",
            fontSize: "0.6rem",
            fontWeight: 600,
            padding: "1px 6px",
            cursor: "pointer",
            lineHeight: 1.6,
          }}
        >
          {selectMode ? "✕ Cancel" : "Select"}
        </button>
      </div>

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((sub) => (
            <SortableSubtaskRow
              key={sub.id}
              sub={sub}
              accentColor={accentColor}
              isMobile={isMobile}
              selectMode={selectMode}
              isSelected={selected.has(sub.id)}
              editingId={editingId}
              onToggle={onToggle}
              onSelectToggle={toggleSelect}
              onEditConfirm={handleEditConfirm}
              onEditStart={handleEditStart}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Select-mode toolbar */}
      {selectMode && (
        <div
          className="flex items-center gap-2 mt-1 p-2 rounded-lg"
          style={{
            background: "rgba(5,5,16,0.95)",
            border: "1px solid rgba(37,37,64,0.9)",
            position: isMobile ? "sticky" : "relative",
            bottom: isMobile ? 0 : undefined,
            zIndex: 10,
          }}
        >
          {selectedCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "#f87171",
                  borderRadius: "6px",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  padding: "3px 8px",
                  cursor: "pointer",
                }}
              >
                🗑 Delete ({selectedCount})
              </button>
              {!isMobile && selectedCount === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const id = [...selected][0];
                    handleEditStart(id);
                    exitSelectMode();
                  }}
                  style={{
                    background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.25)",
                    color: "#60a5fa",
                    borderRadius: "6px",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    padding: "3px 8px",
                    cursor: "pointer",
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </>
          )}
          {selectedCount === 0 && (
            <span style={{ fontSize: "0.62rem", color: "#5e7299" }}>Select subtasks to edit or delete</span>
          )}
          <button
            type="button"
            onClick={exitSelectMode}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "1px solid rgba(0,212,255,0.12)",
              color: "#5e7299",
              borderRadius: "6px",
              fontSize: "0.62rem",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
