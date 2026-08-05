import type { SyncableTable } from "../repositories/base";

/** Local Dexie table name -> remote Supabase/Postgres table name. */
export const REMOTE_TABLE: Record<SyncableTable, string> = {
  categories: "categories",
  questions: "questions",
  questionOptions: "question_options",
  questionStates: "question_states",
  studySessions: "study_sessions",
  sessionAnswers: "session_answers",
};

export const SYNC_TABLES: SyncableTable[] = [
  "categories",
  "questions",
  "questionOptions",
  "questionStates",
  "studySessions",
  "sessionAnswers",
];

// Local-only bookkeeping fields that must never be sent to Supabase.
const LOCAL_ONLY_FIELDS = new Set(["_syncStatus", "_baseUpdatedAt"]);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toRemoteRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (LOCAL_ONLY_FIELDS.has(key)) continue;
    out[camelToSnake(key)] = value;
  }
  return out;
}

export function fromRemoteRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  out._syncStatus = "synced";
  out._baseUpdatedAt = row.updated_at ?? null;
  return out as T;
}
