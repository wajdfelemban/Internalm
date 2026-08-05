import { useSyncStatusStore } from "../state/syncStatusStore";
import { isSupabaseConfigured } from "../supabaseClient";
import { syncNow } from "../sync/useSyncEngine";

export function SyncIndicator() {
  const { phase, isOnline, pendingCount, lastError } = useSyncStatusStore();

  if (!isSupabaseConfigured) {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        Local only
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
      </span>
    );
  }

  if (phase === "syncing") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
        Syncing…
      </span>
    );
  }

  if (phase === "error") {
    return (
      <button
        onClick={() => syncNow()}
        title={lastError ?? "Retry sync"}
        className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Sync error · retry
      </button>
    );
  }

  return (
    <button
      onClick={() => syncNow()}
      title="Sync now"
      className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-600 hover:bg-green-100 dark:bg-green-950 dark:text-green-300"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Synced{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
    </button>
  );
}
