import { getDatabase, type RecallDatabase } from "../db/dexie";
import { supabase } from "../supabaseClient";
import { REMOTE_TABLE, SYNC_TABLES, fromRemoteRow } from "./mapping";
import type { SyncableTable } from "../repositories/base";
import type { BaseSyncFields } from "../db/schema";

const PAGE_SIZE = 500;
const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Bumping this forces every table's pull cursor back to the epoch on the next
 * sync, so a device re-reads the full history once. Needed whenever a fix
 * changes what the cursor *means* — a device that already advanced its
 * watermark past skipped rows would otherwise never see them again.
 */
const CURSOR_VERSION = 2;
const CURSOR_VERSION_KEY = "__cursorVersion";

async function resetCursorsIfStale(db: RecallDatabase): Promise<void> {
  const row = await db.syncMeta.get(CURSOR_VERSION_KEY);
  const stored = row?.lastPulledAt ? Number(row.lastPulledAt) : 0;
  if (stored >= CURSOR_VERSION) return;

  await db.syncMeta.clear();
  await db.syncMeta.put({
    table: CURSOR_VERSION_KEY,
    lastPulledAt: String(CURSOR_VERSION),
    lastPulledId: null,
    deviceId: row?.deviceId ?? "",
  });
}

async function pullTable(ownerId: string, table: SyncableTable): Promise<void> {
  const db = getDatabase();
  const remoteTable = REMOTE_TABLE[table];

  const meta = await db.syncMeta.get(table);
  let cursorAt = meta?.lastPulledAt ?? EPOCH;
  let cursorId = meta?.lastPulledId ?? null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase.from(remoteTable).select("*").eq("owner_id", ownerId);

    if (cursorId) {
      // Keyset pagination over (updated_at, id) rather than updated_at alone.
      // Bulk server-side writes stamp every row in the same transaction with
      // an identical updated_at; when such a tie group straddles a page
      // boundary, a plain `updated_at > cursor` skips the rest of the group
      // forever. Ordering by id as a tiebreaker lets the next page resume
      // mid-group instead.
      query = query.or(
        `updated_at.gt."${cursorAt}",and(updated_at.eq."${cursorAt}",id.gt."${cursorId}")`,
      );
    } else {
      query = query.gt("updated_at", cursorAt);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const last = data[data.length - 1] as { updated_at: string; id: string };

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

      await db.syncMeta.put({
        table,
        lastPulledAt: last.updated_at,
        lastPulledId: last.id,
        deviceId: meta?.deviceId ?? "",
      });
    });

    cursorAt = last.updated_at;
    cursorId = last.id;
    if (data.length < PAGE_SIZE) break;
  }
}

export async function pullChanges(ownerId: string): Promise<void> {
  await resetCursorsIfStale(getDatabase());
  for (const table of SYNC_TABLES) {
    await pullTable(ownerId, table);
  }
}

export async function isFirstHydration(): Promise<boolean> {
  const db = getDatabase();
  const count = await db.syncMeta.count();
  return count === 0;
}
