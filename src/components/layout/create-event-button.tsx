"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { useCreateEventStore } from "@/store";

// ── Floating Action Button (mobile + fallback) ────────────────────
export function CreateEventFAB() {
  const { setCreateEventModalOpen } = useCreateEventStore();

  return (
    <button
      onClick={() => setCreateEventModalOpen(true)}
      aria-label="Create Event (press N)"
      title="Create Event (press N)"
      className={[
        "fixed bottom-20 right-6 z-50",
        "flex items-center justify-center w-14 h-14 rounded-full",
        "bg-cyan text-[#04070e] shadow-[0_4px_20px_rgba(0,209,255,0.35)]",
        "hover:bg-[#00c8f0] hover:shadow-[0_4px_28px_rgba(0,209,255,0.55)]",
        "active:scale-95",
        "transition-all duration-150",
        "sm:hidden", // hidden on sm+ (header button takes over)
      ].join(" ")}
    >
      <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

// ── Header button (sm+) ───────────────────────────────────────────
export function CreateEventHeaderButton() {
  const { setCreateEventModalOpen } = useCreateEventStore();

  return (
    <button
      onClick={() => setCreateEventModalOpen(true)}
      aria-label="Create Event (press N)"
      title="Create Event (press N)"
      className={[
        "hidden sm:flex items-center gap-1.5",
        "h-8 px-3 rounded-lg",
        "bg-[rgba(0,209,255,0.12)] border border-[rgba(0,209,255,0.3)] text-cyan",
        "hover:bg-[rgba(0,209,255,0.2)] hover:border-[rgba(0,209,255,0.5)]",
        "text-xs font-medium",
        "transition-all duration-150",
      ].join(" ")}
    >
      <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
      Create
    </button>
  );
}

// ── Global keyboard shortcut (mount once in layout) ───────────────
export function CreateEventKeyboardShortcut() {
  const { setCreateEventModalOpen, createEventModalOpen } = useCreateEventStore();

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      // Ignore when focus is inside an input/textarea/select/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setCreateEventModalOpen(!createEventModalOpen);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [createEventModalOpen, setCreateEventModalOpen]);

  return null;
}
