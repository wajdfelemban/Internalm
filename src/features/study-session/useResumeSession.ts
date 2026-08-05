import { useEffect } from "react";
import { getDatabase } from "../../db/dexie";
import { useAuthStore } from "../../state/authStore";
import {
  clearActiveSessionPointer,
  getActiveSessionPointer,
  useStudySessionStore,
} from "../../state/studySessionStore";
import { listOptionsForQuestions } from "../../repositories/questionsRepo";
import type { StudyAnswerRecord } from "../../state/studySessionStore";

/**
 * Restores an in-progress study session on app load (page refresh, or
 * reopening the tab) so navigating away mid-session — or reloading — doesn't
 * lose it. Only the (sessionId, questionIds, currentIndex) pointer is
 * persisted; questions/options/answers are always re-read fresh from Dexie.
 */
export function useResumeSession(): void {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    // Don't clobber a session already active in memory (e.g. this hook
    // re-running after an unrelated auth-state change mid-session).
    if (useStudySessionStore.getState().session) return;

    let cancelled = false;

    (async () => {
      const pointer = getActiveSessionPointer(userId);
      if (!pointer) return;

      const db = getDatabase();
      const session = await db.studySessions.get(pointer.sessionId);
      if (!session || session.completedAt || session.deletedAt) {
        clearActiveSessionPointer(userId);
        return;
      }

      const rawQuestions = await db.questions.bulkGet(pointer.questionIds);
      const questions = rawQuestions.filter(
        (q): q is NonNullable<typeof q> => !!q && q.deletedAt === null,
      );
      if (questions.length === 0) {
        clearActiveSessionPointer(userId);
        return;
      }

      const optionsByQuestion = await listOptionsForQuestions(questions.map((q) => q.id));
      const existingAnswers = await db.sessionAnswers.where("sessionId").equals(session.id).toArray();
      const answers = new Map<string, StudyAnswerRecord>(
        existingAnswers.map((a) => [
          a.questionId,
          { questionId: a.questionId, selectedOptionId: a.selectedOptionId, isCorrect: a.isCorrect },
        ]),
      );

      const currentIndex = Math.min(Math.max(pointer.currentIndex, 0), questions.length - 1);

      if (!cancelled) {
        useStudySessionStore.getState().hydrate(session, questions, optionsByQuestion, answers, currentIndex);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
