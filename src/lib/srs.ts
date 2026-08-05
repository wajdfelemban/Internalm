import type { QuestionState, QuestionStatus } from "../db/schema";

/**
 * SM-2-derived spaced repetition scheduler, adapted for binary
 * correct/incorrect multiple-choice answers (rather than SM-2's original
 * 0-5 self-rated quality scale).
 *
 * A correct answer maps to quality 4, an incorrect answer to quality 1 —
 * this keeps the standard SM-2 ease/interval formulas intact while fitting
 * a simple right/wrong UI (no extra "how hard was this" prompt).
 */

export interface SrsUpdateInput {
  status: QuestionStatus;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  isCorrect: boolean;
  now: Date;
}

export interface SrsUpdateResult {
  status: QuestionStatus;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string;
}

const MIN_EASE_FACTOR = 1.3;

export function computeSrsUpdate(input: SrsUpdateInput): SrsUpdateResult {
  const quality = input.isCorrect ? 4 : 1;
  const nowIso = input.now.toISOString();

  let { repetitions, easeFactor, lapses } = input;
  let intervalDays: number;

  if (quality < 3) {
    // Lapse: reset the learning streak but keep the (slightly penalized) ease factor.
    repetitions = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(input.intervalDays * easeFactor);
    }
  }

  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(easeFactor, MIN_EASE_FACTOR);

  const status: QuestionStatus = repetitions >= 2 ? "review" : "learning";

  const dueAt = new Date(input.now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    status,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
    lapses,
    dueAt: dueAt.toISOString(),
    lastReviewedAt: nowIso,
  };
}

/** Fresh SRS defaults for a question the user has never seen. */
export function initialSrsState(): Pick<
  QuestionState,
  "status" | "dueAt" | "intervalDays" | "easeFactor" | "repetitions" | "lapses"
> {
  return {
    status: "new",
    dueAt: null,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
  };
}

export function isDue(state: Pick<QuestionState, "dueAt" | "status">, now: Date): boolean {
  if (state.status === "new") return true;
  if (!state.dueAt) return false;
  return new Date(state.dueAt).getTime() <= now.getTime();
}

/**
 * A question counts as "mastered" once its review interval has grown past
 * this many days — the same threshold Anki uses for a "mature" card. Long
 * interval means repeated correct recalls, i.e. it's actually memorized
 * rather than just recently learned.
 */
export const MASTERED_INTERVAL_DAYS = 21;

export function isMastered(state: Pick<QuestionState, "status" | "intervalDays">): boolean {
  return state.status === "review" && state.intervalDays >= MASTERED_INTERVAL_DAYS;
}
