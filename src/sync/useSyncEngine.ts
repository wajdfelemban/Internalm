import { useEffect } from "react";
import { useAuthStore } from "../state/authStore";
import { useSyncStatusStore } from "../state/syncStatusStore";
import { refreshPendingCount, runSyncCycle } from "./syncEngine";

const FOREGROUND_INTERVAL_MS = 45_000;

/** Wires up all the triggers that kick off a sync cycle: login, reconnect, tab foreground, and a periodic poll while online. */
export function useSyncEngine() {
  const userId = useAuthStore((s) => s.user?.id);
  const isLocalOnly = useAuthStore((s) => s.isLocalOnly);

  useEffect(() => {
    // A "continue without an account" session has no Supabase auth token,
    // so there's nothing valid to sync — don't wire up the engine at all.
    if (!userId || isLocalOnly) return;

    refreshPendingCount();
    const sync = () => runSyncCycle(userId);

    sync();

    const handleOnline = () => {
      useSyncStatusStore.getState().setOnline(true);
      sync();
    };
    const handleOffline = () => useSyncStatusStore.getState().setOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(sync, FOREGROUND_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [userId, isLocalOnly]);
}

export function syncNow() {
  const { user, isLocalOnly } = useAuthStore.getState();
  if (user?.id && !isLocalOnly) return runSyncCycle(user.id);
}
