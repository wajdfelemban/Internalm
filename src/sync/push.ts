import { getDatabase, type SyncQueueItem } from "../db/dexie";
import { supabase } from "../supabaseClient";
import { REMOTE_TABLE } from "./mapping";
import { toRemoteRow, fromRemoteRow } from "./mapping";
import type { SyncableTable } from "../repositories/base";

const MAX_ATTEMPTS = 8;

interface CollapsedItem {
  ids: number[];
  table: SyncableTable;
  rowId: string;
  op: SyncQueueItem["op"];
  payload: unknown;
}

/** Keep only the latest queued mutation per (table, rowId) — a delete always wins. */
function collapseQueue(items: SyncQueueItem[]): CollapsedItem[] {
  const byKey = new Map<string, CollapsedItem>();
  for (const item of items) {
    const key = `${item.table}:${item.rowId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ids: [item.id!],
        table: item.table as SyncableTable,
        rowId: item.rowId,
        op: item.op,
        payload: item.payload,
      });
    } else {
      existing.ids.push(item.id!);
      if (item.op === "delete" || existing.op !== "delete") {
        existing.op = item.op;
        existing.payload = item.payload;
      }
    }
  }
  return [...byKey.values()];
}

export interface PushResult {
  pushed: number;
  failed: number;
}

/** Drains the local syncQueue: pushes pending local writes up to Supabase. */
export async function pushChanges(): Promise<PushResult> {
  const db = getDatabase();
  const rawItems = await db.syncQueue.orderBy("createdAt").toArray();
  const items = collapseQueue(rawItems);

  let pushed = 0;
  let failed = 0;

  for (const item of items) {
    const remoteTable = REMOTE_TABLE[item.table];
    try {
      if (item.op === "delete") {
        const payload = item.payload as { id: string; deletedAt: string };
        const { error } = await supabase
          .from(remoteTable)
          .update({ deleted_at: payload.deletedAt })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const remoteRow = toRemoteRow(item.payload as Record<string, unknown>);
        const { data, error } = await supabase
          .from(remoteTable)
          .upsert(remoteRow, { onConflict: "id" })
          .select()
          .single();
        if (error) throw error;

        // Reconcile local row with the server-stamped updated_at so the
        // next optimistic-concurrency check has the right baseline.
        if (data) {
          const synced = fromRemoteRow<Record<string, unknown>>(data);
          await db.table(item.table).update(item.rowId, {
            updatedAt: synced.updatedAt,
            _syncStatus: "synced",
            _baseUpdatedAt: synced.updatedAt,
          });
        }
      }

      await db.syncQueue.bulkDelete(item.ids);
      pushed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      const attempts = Math.max(
        ...(await db.syncQueue.bulkGet(item.ids)).map((r) => (r?.attempts ?? 0) + 1),
      );

      if (attempts >= MAX_ATTEMPTS) {
        // Stop retrying a permanently-failing row (e.g. an RLS/validation
        // error) so it doesn't block the rest of the queue forever; surface
        // it to the user instead.
        await db.table(item.table).update(item.rowId, { _syncStatus: "error" });
      }

      await Promise.all(
        item.ids.map((id) => db.syncQueue.update(id, { attempts, lastError: message })),
      );
    }
  }

  return { pushed, failed };
}
