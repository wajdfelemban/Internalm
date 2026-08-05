// Shared types mirrored between the local Dexie (IndexedDB) tables and the
// Supabase/Postgres schema (see supabase/migrations). Field names here are
// camelCase; the SQL side uses snake_case — mapping happens in the sync layer.

export type SyncStatus = "synced" | "pending" | "conflict" | "error";

export interface BaseSyncFields {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Local-only: not persisted to Supabase. */
  _syncStatus: SyncStatus;
  /** Local-only: the updatedAt this row was last pulled/forked from, used for optimistic-concurrency conflict detection. */
  _baseUpdatedAt: string | null;
}

export interface Category extends BaseSyncFields {
  parentId: string | null;
  name: string;
  position: number;
}

export interface Question extends BaseSyncFields {
  categoryId: string;
  prompt: string;
  explanation: string | null;
}

export interface QuestionOption extends BaseSyncFields {
  questionId: string;
  text: string;
  isCorrect: boolean;
  position: number;
  /** Why this specific option is right/wrong — shown under the option after answering. */
  explanation: string | null;
}

export type QuestionStatus = "new" | "learning" | "review";
export type LastResult = "correct" | "wrong" | null;

/** Per-user spaced-repetition + study state for a single question (SM-2-derived). */
export interface QuestionState extends BaseSyncFields {
  questionId: string;
  status: QuestionStatus;
  dueAt: string | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: string | null;
  isFlagged: boolean;
  isHighlighted: boolean;
  notes: string;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  lastResult: LastResult;
}

export type PoolFilter =
  | "smart"
  | "due"
  | "all"
  | "unseen"
  | "wrong"
  | "flagged"
  | "highlighted"
  | "mastered";

export interface StudySession extends BaseSyncFields {
  categoryId: string | null;
  includeSubcategories: boolean;
  poolFilter: PoolFilter;
  requestedCount: number;
  startedAt: string;
  completedAt: string | null;
  correctCount: number;
  totalCount: number;
}

export interface SessionAnswer extends BaseSyncFields {
  sessionId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  answeredAt: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const POOL_FILTER_LABELS: Record<PoolFilter, string> = {
  smart: "Smart (Due + New)",
  due: "Due for review",
  all: "All",
  unseen: "Unseen",
  wrong: "Wrong",
  flagged: "Flagged",
  highlighted: "Highlighted",
  mastered: "Mastered",
};
