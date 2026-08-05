import { create } from "zustand";
import type { Question, QuestionOption, StudySession } from "../db/schema";

export interface StudyAnswerRecord {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
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
  goTo: (index: number) => void;
  next: () => void;
  back: () => void;
  recordAnswerLocal: (record: StudyAnswerRecord) => void;
  reset: () => void;
}

export const useStudySessionStore = create<StudySessionState>((set, get) => ({
  session: null,
  questions: [],
  optionsByQuestion: new Map(),
  currentIndex: 0,
  answers: new Map(),

  begin: (session, questions, optionsByQuestion) =>
    set({ session, questions, optionsByQuestion, currentIndex: 0, answers: new Map() }),

  goTo: (index) => {
    const { questions } = get();
    if (index < 0 || index >= questions.length) return;
    set({ currentIndex: index });
  },

  next: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) set({ currentIndex: currentIndex + 1 });
  },

  back: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1 });
  },

  recordAnswerLocal: (record) => {
    const answers = new Map(get().answers);
    answers.set(record.questionId, record);
    set({ answers });
  },

  reset: () => set({ session: null, questions: [], optionsByQuestion: new Map(), currentIndex: 0, answers: new Map() }),
}));
