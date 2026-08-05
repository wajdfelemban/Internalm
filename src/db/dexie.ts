import Dexie, { type EntityTable } from "dexie";
import type {
  Category,
  Question,
  QuestionOption,
  QuestionState,
  StudySession,
  SessionAnswer,
} from "./schema";

export interface SyncQueueItem {
  id?: number;
  table: string;
  rowId: string;
  op: "insert" | "update" | "delete";
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface SyncMetaRow {
  table: string;
  lastPulledAt: string | null;
  /** Second half of the pull cursor — see pull.ts. Null on pre-keyset rows. */
  lastPulledId?: string | null;
  deviceId: string;
}

export type RecallDatabase = Dexie & {
  categories: EntityTable<Category, "id">;
  questions: EntityTable<Question, "id">;
  questionOptions: EntityTable<QuestionOption, "id">;
  questionStates: EntityTable<QuestionState, "id">;
  studySessions: EntityTable<StudySession, "id">;
  sessionAnswers: EntityTable<SessionAnswer, "id">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
  syncMeta: EntityTable<SyncMetaRow, "table">;
};

let dbInstance: RecallDatabase | null = null;
let currentUserId: string | null = null;

/**
 * Each user gets a separate Dexie database, namespaced by user id, so that
 * sequential logins on a shared browser never leak data across accounts.
 */
export function openDatabaseForUser(userId: string): RecallDatabase {
  if (dbInstance && currentUserId === userId) return dbInstance;
  if (dbInstance) dbInstance.close();

  const db = new Dexie(`recall-${userId}`) as RecallDatabase;

  db.version(1).stores({
    categories: "id, ownerId, parentId, deletedAt, updatedAt",
    questions: "id, ownerId, categoryId, deletedAt, updatedAt",
    questionOptions: "id, ownerId, questionId, deletedAt, updatedAt",
    questionStates:
      "id, ownerId, questionId, status, dueAt, isFlagged, isHighlighted, deletedAt, updatedAt",
    studySessions: "id, ownerId, startedAt, categoryId, deletedAt, updatedAt",
    sessionAnswers: "id, ownerId, sessionId, questionId, updatedAt",
    syncQueue: "++id, table, rowId, createdAt",
    syncMeta: "table",
  });

  currentUserId = userId;
  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  dbInstance?.close();
  dbInstance = null;
  currentUserId = null;
}

export function getDatabase(): RecallDatabase {
  if (!dbInstance) {
    throw new Error("Database not open — call openDatabaseForUser() after login first.");
  }
  return dbInstance;
}
