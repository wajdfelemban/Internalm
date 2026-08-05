import { create } from "zustand";
import type { Question, QuestionOption, StudySession } from "../db/schema";

export interface StudyAnswerRecord {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
}

export interface ActiveSessionPointer {
  sessionId: string;
  questionIds: string[];
  currentIndex: number;
}

function storageKey(ownerId: string): string {
  return `recall-active-session-${ownerId}`;
}

/** Persists just enough to resume after a navigation or full page reload — the actual question/answer content is always re-read fresh from Dexie. */
function persistPointer(session: StudySession | null, questions: Question[], currentIndex: number): void {
  if (!session) return;
  try {
    const pointer: ActiveSessionPointer = {
      sessionId: session.id,
      questionIds: questions.map((q) => q.id),
      currentIndex,
    };
    localStorage.setItem(storageKey(session.ownerId), JSON.stringify(pointer));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — session just won't survive a refresh.
  }
}

export function clearActiveSessionPointer(ownerId: string): void {
  try {
    localStorage.removeItem(storageKey(ownerId));
  } catch {
    // ignore
  }
}

export function getActiveSessionPointer(ownerId: string): ActiveSessionPointer | null {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    return raw ? (JSON.parse(raw) as ActiveSessionPointer) : null;
  } catch {
    return null;
  }
}

interface StudySessionState {
  session: StudySession | null;
  questions: Question[];
  optionsByQuestion: Map<string, QuestionOption[]>;
  currentIndex: number;
  answers: Map<string, StudyAnswerRecord>;

  begin: (
    session: StudySession,
    questions: Question[],
    optionsByQuestion: Map<string, QuestionOption[]>,
  ) => void;
  /** Restores an in-progress session (e.g. after a page reload) without resetting progress already made. */
  hydrate: (
    session: StudySession,
    questions: Question[],
    optionsByQuestion: Map<string, QuestionOption[]>,
    answers: Map<string, StudyAnswerRecord>,
    currentIndex: number,
  ) => void;
  goTo: (index: number) => void;
  next: () => void;
  back: () => void;
  recordAnswerLocal: (record: StudyAnswerRecord) => void;
  /** Ends the session — clears in-progress state and its persisted pointer. Does not touch the DB row (caller marks it completed separately). */
  reset: () => void;
}

export const useStudySessionStore = create<StudySessionState>((set, get) => ({
  session: null,
  questions: [],
  optionsByQuestion: new Map(),
  currentIndex: 0,
  answers: new Map(),

  begin: (session, questions, optionsByQuestion) => {
    set({ session, questions, optionsByQuestion, currentIndex: 0, answers: new Map() });
    persistPointer(session, questions, 0);
  },

  hydrate: (session, questions, optionsByQuestion, answers, currentIndex) => {
    set({ session, questions, optionsByQuestion, currentIndex, answers });
    persistPointer(session, questions, currentIndex);
  },

  goTo: (index) => {
    const { questions, session } = get();
    if (index < 0 || index >= questions.length) return;
    set({ currentIndex: index });
    persistPointer(session, questions, index);
  },

  next: () => {
    const { currentIndex, questions, session } = get();
    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      persistPointer(session, questions, currentIndex + 1);
    }
  },

  back: () => {
    const { currentIndex, questions, session } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      persistPointer(session, questions, currentIndex - 1);
    }
  },

  recordAnswerLocal: (record) => {
    const answers = new Map(get().answers);
    answers.set(record.questionId, record);
    set({ answers });
  },

  reset: () => {
    const ownerId = get().session?.ownerId;
    if (ownerId) clearActiveSessionPointer(ownerId);
    set({ session: null, questions: [], optionsByQuestion: new Map(), currentIndex: 0, answers: new Map() });
  },
}));
