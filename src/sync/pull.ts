import { getDatabase } from "../db/dexie";
import { supabase } from "../supabaseClient";
import { REMOTE_TABLE, SYNC_TABLES, fromRemoteRow } from "./mapping";
import type { SyncableTable } from "../repositories/base";
import type { BaseSyncFields } from "../db/schema";

const PAGE_SIZE = 500;
const EPOCH = "1970-01-01T00:00:00.000Z";

async function pullTable(ownerId: string, table: SyncableTable): Promise<void> {
  const db = getDatabase();
  const remoteTable = REMOTE_TABLE[table];

  const meta = await db.syncMeta.get(table);
  let cursor = meta?.lastPulledAt ?? EPOCH;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(remoteTable)
      .select("*")
      .eq("owner_id", ownerId)
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) throw error;
    if (!data || data.length === 0) break;

    await db.transaction("rw", db.table(table), db.syncMeta, async () => {
      for (const remoteRow of data) {
        const local = fromRemoteRow<BaseSyncFields & Record<string, unknown>>(remoteRow);
        const existing = (await db.table(table).get(local.id)) as
          | (BaseSyncFields & { _syncStatus: string })
          | undefined;

        // Never clobber a row with unsynced local edits — it'll reconcile
        // once the push side drains and re-pulls the server's response.
        if (existing && existing._syncStatus === "pending") continue;

        await db.table(table).put(local);
      }

      const newCursor = data[data.length - 1].updated_at as string;
      await db.syncMeta.put({ table, lastPulledAt: newCursor, deviceId: meta?.deviceId ?? "" });
    });

    cursor = data[data.length - 1].updated_at as string;
    if (data.length < PAGE_SIZE) break;
  }
}

export async function pullChanges(ownerId: string): Promise<void> {
  for (const table of SYNC_TABLES) {
    await pullTable(ownerId, table);
  }
}

export async function isFirstHydration(): Promise<boolean> {
  const db = getDatabase();
  const count = await db.syncMeta.count();
  return count === 0;
}
