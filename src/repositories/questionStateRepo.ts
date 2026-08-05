import { getDatabase } from "../db/dexie";
import { newId, nowIso } from "../lib/id";
import type { PoolFilter, QuestionState } from "../db/schema";
import { baseFields, insertRow, updateRow } from "./base";
import { computeSrsUpdate, initialSrsState, isDue, isMastered } from "../lib/srs";

export async function createQuestionState(
  ownerId: string,
  questionId: string,
): Promise<QuestionState> {
  const state: QuestionState = {
    ...baseFields(ownerId, newId()),
    questionId,
    ...initialSrsState(),
    lastReviewedAt: null,
    isFlagged: false,
    isHighlighted: false,
    notes: "",
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    lastResult: null,
  };
  return insertRow("questionStates", state);
}

export async function getStateForQuestion(
  ownerId: string,
  questionId: string,
): Promise<QuestionState | undefined> {
  const db = getDatabase();
  return db.questionStates
    .where("questionId")
    .equals(questionId)
    .filter((s) => s.ownerId === ownerId && s.deletedAt === null)
    .first();
}

export async function statesForQuestions(
  ownerId: string,
  questionIds: string[],
): Promise<Map<string, QuestionState>> {
  const db = getDatabase();
  const rows = await db.questionStates
    .where("questionId")
    .anyOf(questionIds)
    .filter((s) => s.ownerId === ownerId && s.deletedAt === null)
    .toArray();
  return new Map(rows.map((r) => [r.questionId, r]));
}

export async function toggleFlag(id: string, isFlagged: boolean): Promise<void> {
  await updateRow<QuestionState>("questionStates", id, { isFlagged });
}

export async function toggleHighlight(id: string, isHighlighted: boolean): Promise<void> {
  await updateRow<QuestionState>("questionStates", id, { isHighlighted });
}

export async function setNotes(id: string, notes: string): Promise<void> {
  await updateRow<QuestionState>("questionStates", id, { notes });
}

/** Applies the SM-2 update after the user answers a question during a study session. */
export async function recordAnswer(
  state: QuestionState,
  isCorrect: boolean,
): Promise<QuestionState> {
  const now = new Date();
  const srs = computeSrsUpdate({
    status: state.status,
    intervalDays: state.intervalDays,
    easeFactor: state.easeFactor,
    repetitions: state.repetitions,
    lapses: state.lapses,
    isCorrect,
    now,
  });

  return updateRow<QuestionState>("questionStates", state.id, {
    ...srs,
    timesSeen: state.timesSeen + 1,
    timesCorrect: state.timesCorrect + (isCorrect ? 1 : 0),
    timesWrong: state.timesWrong + (isCorrect ? 0 : 1),
    lastResult: isCorrect ? "correct" : "wrong",
  });
}

/** Which pools a question currently belongs to — drives the per-question badge shown during study ("New", "Due", "Wrong", "Flagged", "Highlighted", "Mastered"). */
export function tagsForState(state: QuestionState | undefined, now: Date = new Date()): string[] {
  if (!state) return ["New"];
  const tags: string[] = [];
  if (state.status === "new") tags.push("New");
  else if (isDue(state, now)) tags.push("Due");
  if (state.lastResult === "wrong") tags.push("Wrong");
  if (state.isFlagged) tags.push("Flagged");
  if (state.isHighlighted) tags.push("Highlighted");
  if (isMastered(state)) tags.push("Mastered");
  return tags;
}

export function matchesPool(
  state: QuestionState | undefined,
  filter: PoolFilter,
  now: Date = new Date(),
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "smart":
      return !state || state.status === "new" || isDue(state, now);
    case "due":
      return !!state && state.status !== "new" && isDue(state, now);
    case "unseen":
      return !state || state.timesSeen === 0;
    case "wrong":
      return state?.lastResult === "wrong";
    case "flagged":
      return !!state?.isFlagged;
    case "highlighted":
      return !!state?.isHighlighted;
    case "mastered":
      return !!state && isMastered(state);
    default:
      return true;
  }
}

export function nowStamp(): string {
  return nowIso();
}
