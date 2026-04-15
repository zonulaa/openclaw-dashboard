import { create } from "zustand";

export type CreateEventTab = "task" | "calendar" | "cron" | "reminder";

interface CreateEventStore {
  createEventModalOpen: boolean;
  defaultTab: CreateEventTab;
  setCreateEventModalOpen: (open: boolean) => void;
  setDefaultTab: (tab: CreateEventTab) => void;
}

export const useCreateEventStore = create<CreateEventStore>((set) => ({
  createEventModalOpen: false,
  defaultTab: "task",
  setCreateEventModalOpen: (open) => set({ createEventModalOpen: open }),
  setDefaultTab: (tab) => set({ defaultTab: tab }),
}));
