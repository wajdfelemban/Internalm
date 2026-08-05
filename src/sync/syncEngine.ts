import { getDatabase } from "../db/dexie";
import { isSupabaseConfigured } from "../supabaseClient";
import { useSyncStatusStore } from "../state/syncStatusStore";
import { pushChanges } from "./push";
import { pullChanges } from "./pull";

let cycleRunning = false;

async function withTabLock<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  // Coordinates the sync cycle across multiple open tabs so they don't
  // double-push/double-pull concurrently. Falls back to running directly
  // if the Web Locks API isn't available.
  if (!("locks" in navigator)) return fn();
  return (navigator as unknown as { locks: { request: (n: string, f: () => Promise<T>) => Promise<T> } }).locks
    .request(name, fn);
}

export async function refreshPendingCount(): Promise<void> {
  const db = getDatabase();
  const count = await db.syncQueue.count();
  useSyncStatusStore.getState().setPendingCount(count);
}

export async function runSyncCycle(ownerId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!navigator.onLine) return;
  if (cycleRunning) return;
  cycleRunning = true;

  const status = useSyncStatusStore.getState();
  status.setPhase("syncing");

  try {
    await withTabLock(`recall-sync-${ownerId}`, async () => {
      await pushChanges();
      await pullChanges(ownerId);
      await pushChanges(); // catch anything that changed locally while pulling
    });
    await refreshPendingCount();
    status.setLastSyncedAt(new Date().toISOString());
    status.setError(null);
  } catch (err) {
    status.setError(err instanceof Error ? err.message : "Sync failed");
  } finally {
    cycleRunning = false;
  }
}
