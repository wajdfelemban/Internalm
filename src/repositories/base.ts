import { getDatabase, type RecallDatabase } from "../db/dexie";
import { nowIso } from "../lib/id";
import type { BaseSyncFields } from "../db/schema";

export type SyncableTable =
  | "categories"
  | "questions"
  | "questionOptions"
  | "questionStates"
  | "studySessions"
  | "sessionAnswers";

async function enqueueSync(
  db: RecallDatabase,
  table: SyncableTable,
  rowId: string,
  op: "insert" | "update" | "delete",
  payload: unknown,
): Promise<void> {
  await db.syncQueue.add({
    table,
    rowId,
    op,
    payload,
    createdAt: nowIso(),
    attempts: 0,
  });
}

export async function insertRow<T extends BaseSyncFields>(
  table: SyncableTable,
  row: T,
): Promise<T> {
  const db = getDatabase();
  await db.transaction("rw", db.table(table), db.syncQueue, async () => {
    await db.table(table).add(row);
    await enqueueSync(db, table, row.id, "insert", row);
  });
  return row;
}

export async function updateRow<T extends BaseSyncFields>(
  table: SyncableTable,
  id: string,
  patch: Partial<Omit<T, "id" | "ownerId" | "createdAt">>,
): Promise<T> {
  const db = getDatabase();
  let full!: T;
  await db.transaction("rw", db.table(table), db.syncQueue, async () => {
    const updatedAt = nowIso();
    await db
      .table(table)
      .update(id, { ...patch, updatedAt, _syncStatus: "pending" });
    full = (await db.table(table).get(id)) as T;
    await enqueueSync(db, table, id, "update", full);
  });
  return full;
}

export async function softDeleteRow(
  table: SyncableTable,
  id: string,
): Promise<void> {
  const db = getDatabase();
  await db.transaction("rw", db.table(table), db.syncQueue, async () => {
    const deletedAt = nowIso();
    await db
      .table(table)
      .update(id, { deletedAt, updatedAt: deletedAt, _syncStatus: "pending" });
    await enqueueSync(db, table, id, "delete", { id, deletedAt });
  });
}

export function baseFields(ownerId: string, id: string): BaseSyncFields {
  const ts = nowIso();
  return {
    id,
    ownerId,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    _syncStatus: "pending",
    _baseUpdatedAt: null,
  };
}
