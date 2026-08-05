import { getDatabase } from "../db/dexie";
import { newId, nowIso } from "../lib/id";
import type { PoolFilter, Question, SessionAnswer, StudySession } from "../db/schema";
import { baseFields, insertRow, updateRow } from "./base";
import { isDue } from "../lib/srs";
import { matchesPool, statesForQuestions } from "./questionStateRepo";
import { listQuestionsByCategoryIds } from "./questionsRepo";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ALL_POOL_FILTERS: PoolFilter[] = [
  "smart",
  "all",
  "unseen",
  "wrong",
  "flagged",
  "highlighted",
];

/** How many questions match each pool filter, for the study-setup screen. */
export async function poolCounts(
  ownerId: string,
  categoryIds: string[],
): Promise<Record<PoolFilter, number>> {
  const questions = await listQuestionsByCategoryIds(ownerId, categoryIds);
  const states = await statesForQuestions(
    ownerId,
    questions.map((q) => q.id),
  );
  const now = new Date();

  const counts = {} as Record<PoolFilter, number>;
  for (const filter of ALL_POOL_FILTERS) {
    counts[filter] = questions.filter((q) => matchesPool(states.get(q.id), filter, now)).length;
  }
  return counts;
}

export async function buildQuestionPool(
  ownerId: string,
  categoryIds: string[],
  poolFilter: PoolFilter,
  requestedCount: number,
): Promise<Question[]> {
  const questions = await listQuestionsByCategoryIds(ownerId, categoryIds);
  const states = await statesForQuestions(
    ownerId,
    questions.map((q) => q.id),
  );
  const now = new Date();

  let candidates = questions.filter((q) => matchesPool(states.get(q.id), poolFilter, now));

  if (poolFilter === "smart") {
    // Due-for-review questions first, then brand-new ones, so a capped
    // session count prioritizes what's actually due.
    const due = candidates.filter((q) => {
      const s = states.get(q.id);
      return s && s.status !== "new" && isDue(s, now);
    });
    const fresh = candidates.filter((q) => {
      const s = states.get(q.id);
      return !s || s.status === "new";
    });
    candidates = [...shuffle(due), ...shuffle(fresh)];
  } else {
    candidates = shuffle(candidates);
  }

  return candidates.slice(0, requestedCount);
}

export async function startSession(
  ownerId: string,
  categoryId: string | null,
  includeSubcategories: boolean,
  poolFilter: PoolFilter,
  requestedCount: number,
): Promise<StudySession> {
  const session: StudySession = {
    ...baseFields(ownerId, newId()),
    categoryId,
    includeSubcategories,
    poolFilter,
    requestedCount,
    startedAt: nowIso(),
    completedAt: null,
    correctCount: 0,
    totalCount: 0,
  };
  return insertRow("studySessions", session);
}

export async function recordSessionAnswer(
  session: StudySession,
  questionId: string,
  selectedOptionId: string | null,
  isCorrect: boolean,
): Promise<SessionAnswer> {
  const answer: SessionAnswer = {
    ...baseFields(session.ownerId, newId()),
    sessionId: session.id,
    questionId,
    selectedOptionId,
    isCorrect,
    answeredAt: nowIso(),
  };
  await insertRow("sessionAnswers", answer);
  await updateRow<StudySession>("studySessions", session.id, {
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    totalCount: session.totalCount + 1,
  });
  return answer;
}

export async function completeSession(session: StudySession): Promise<void> {
  await updateRow<StudySession>("studySessions", session.id, {
    completedAt: nowIso(),
  });
}

export async function listSessions(ownerId: string): Promise<StudySession[]> {
  const db = getDatabase();
  const rows = await db.studySessions
    .where("ownerId")
    .equals(ownerId)
    .filter((s) => s.deletedAt === null && s.completedAt !== null)
    .toArray();
  return rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function answersForSession(sessionId: string): Promise<SessionAnswer[]> {
  const db = getDatabase();
  return db.sessionAnswers.where("sessionId").equals(sessionId).toArray();
}

export function sessionAccuracy(session: Pick<StudySession, "correctCount" | "totalCount">): number {
  if (session.totalCount === 0) return 0;
  return Math.round((session.correctCount / session.totalCount) * 100);
}

export async function overallAccuracy(ownerId: string): Promise<{ correct: number; total: number; accuracy: number }> {
  const sessions = await listSessions(ownerId);
  const correct = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  const total = sessions.reduce((sum, s) => sum + s.totalCount, 0);
  return { correct, total, accuracy: total === 0 ? 0 : Math.round((correct / total) * 100) };
}
