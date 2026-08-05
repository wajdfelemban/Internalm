import { getDatabase, type SyncQueueItem } from "../db/dexie";
import { supabase } from "../supabaseClient";
import { REMOTE_TABLE } from "./mapping";
import { toRemoteRow, fromRemoteRow } from "./mapping";
import type { SyncableTable } from "../repositories/base";
import { nowIso } from "../lib/id";

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 200;

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface PushResult {
  pushed: number;
  failed: number;
}

async function markFailed(db: ReturnType<typeof getDatabase>, items: CollapsedItem[], message: string) {
  for (const item of items) {
    const attempts = Math.max(
      ...(await db.syncQueue.bulkGet(item.ids)).map((r) => (r?.attempts ?? 0) + 1),
    );
    if (attempts >= MAX_ATTEMPTS) {
      // Stop retrying a permanently-failing row (e.g. an RLS/validation
      // error) so it doesn't block the rest of the queue forever; surface
      // it to the user instead.
      await db.table(item.table).update(item.rowId, { _syncStatus: "error" });
    }
    await Promise.all(item.ids.map((id) => db.syncQueue.update(id, { attempts, lastError: message })));
  }
}

/**
 * Drains the local syncQueue: pushes pending local writes up to Supabase.
 * Batches same-table upserts/deletes into array calls (BATCH_SIZE rows per
 * request) instead of one network round-trip per row — a large backlog
 * (e.g. a CSV import's worth of new questions) previously meant thousands
 * of sequential HTTP calls and could take tens of minutes.
 */
export async function pushChanges(): Promise<PushResult> {
  const db = getDatabase();
  const rawItems = await db.syncQueue.orderBy("createdAt").toArray();
  const items = collapseQueue(rawItems);

  let pushed = 0;
  let failed = 0;

  const byTableAndOp = new Map<string, CollapsedItem[]>();
  for (const item of items) {
    const key = `${item.table}:${item.op === "delete" ? "delete" : "upsert"}`;
    const list = byTableAndOp.get(key) ?? [];
    list.push(item);
    byTableAndOp.set(key, list);
  }

  for (const [key, group] of byTableAndOp) {
    const [table, opKind] = key.split(":") as [SyncableTable, "delete" | "upsert"];
    const remoteTable = REMOTE_TABLE[table];

    for (const batch of chunk(group, BATCH_SIZE)) {
      try {
        if (opKind === "delete") {
          const ids = batch.map((item) => (item.payload as { id: string }).id);
          const { error } = await supabase
            .from(remoteTable)
            .update({ deleted_at: nowIso() })
            .in("id", ids);
          if (error) throw error;
        } else {
          const remoteRows = batch.map((item) => toRemoteRow(item.payload as Record<string, unknown>));
          const { data, error } = await supabase
            .from(remoteTable)
            .upsert(remoteRows, { onConflict: "id" })
            .select();
          if (error) throw error;

          // Reconcile local rows with the server-stamped updated_at so the
          // next optimistic-concurrency check has the right baseline.
          for (const row of data ?? []) {
            const synced = fromRemoteRow<Record<string, unknown> & { id: string }>(row);
            await db.table(table).update(synced.id, {
              updatedAt: synced.updatedAt,
              _syncStatus: "synced",
              _baseUpdatedAt: synced.updatedAt,
            });
          }
        }

        await db.syncQueue.bulkDelete(batch.flatMap((item) => item.ids));
        pushed += batch.length;
      } catch (err) {
        failed += batch.length;
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(db, batch, message);
      }
    }
  }

  return { pushed, failed };
}
