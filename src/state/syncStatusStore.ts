import { create } from "zustand";

export type SyncPhase = "idle" | "syncing" | "error";

interface SyncStatusState {
  phase: SyncPhase;
  isOnline: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
  setPhase: (phase: SyncPhase) => void;
  setOnline: (isOnline: boolean) => void;
  setLastSyncedAt: (iso: string) => void;
  setPendingCount: (count: number) => void;
  setError: (message: string | null) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  phase: "idle",
  isOnline: navigator.onLine,
  lastSyncedAt: null,
  pendingCount: 0,
  lastError: null,
  setPhase: (phase) => set({ phase }),
  setOnline: (isOnline) => set({ isOnline }),
  setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setError: (message) => set({ lastError: message, phase: message ? "error" : "idle" }),
}));
