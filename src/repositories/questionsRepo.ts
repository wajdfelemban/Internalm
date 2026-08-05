import { getDatabase } from "../db/dexie";
import type { SyncQueueItem } from "../db/dexie";
import { newId, nowIso } from "../lib/id";
import type { Question, QuestionOption, QuestionState } from "../db/schema";
import { baseFields, insertRow, softDeleteRow, updateRow } from "./base";
import { createQuestionState } from "./questionStateRepo";
import { initialSrsState } from "../lib/srs";

export interface NewOptionInput {
  text: string;
  isCorrect: boolean;
  explanation?: string | null;
}

export interface QuestionWithOptions {
  question: Question;
  options: QuestionOption[];
}

export async function createQuestion(
  ownerId: string,
  categoryId: string,
  prompt: string,
  explanation: string | null,
  options: NewOptionInput[],
): Promise<QuestionWithOptions> {
  const question: Question = {
    ...baseFields(ownerId, newId()),
    categoryId,
    prompt,
    explanation,
  };
  await insertRow("questions", question);

  const optionRows: QuestionOption[] = [];
  for (const [index, opt] of options.entries()) {
    const row: QuestionOption = {
      ...baseFields(ownerId, newId()),
      questionId: question.id,
      text: opt.text,
      isCorrect: opt.isCorrect,
      position: index,
      explanation: opt.explanation ?? null,
    };
    await insertRow("questionOptions", row);
    optionRows.push(row);
  }

  // Every question gets a per-user SRS/study state row up front so it shows
  // up in "Unseen"/"Smart" pools immediately.
  await createQuestionState(ownerId, question.id);

  return { question, options: optionRows };
}

export interface BulkQuestionInput {
  categoryId: string;
  prompt: string;
  explanation: string | null;
  isHighlighted?: boolean;
  options: NewOptionInput[];
}

/**
 * Batch-creates many questions (e.g. from a CSV import) in a handful of
 * large Dexie transactions instead of one tiny transaction per row — a
 * 1000-question import via createQuestion() one row at a time would mean
 * thousands of sequential awaited transactions.
 */
export async function bulkCreateQuestions(
  ownerId: string,
  items: BulkQuestionInput[],
): Promise<{ questionsCreated: number; optionsCreated: number }> {
  const db = getDatabase();
  const questions: Question[] = [];
  const options: QuestionOption[] = [];
  const states: QuestionState[] = [];
  const queueItems: Omit<SyncQueueItem, "id">[] = [];

  const enqueue = (table: SyncQueueItem["table"], rowId: string, payload: unknown) => {
    queueItems.push({ table, rowId, op: "insert", payload, createdAt: nowIso(), attempts: 0 });
  };

  for (const item of items) {
    const question: Question = {
      ...baseFields(ownerId, newId()),
      categoryId: item.categoryId,
      prompt: item.prompt,
      explanation: item.explanation,
    };
    questions.push(question);
    enqueue("questions", question.id, question);

    item.options.forEach((opt, index) => {
      const option: QuestionOption = {
        ...baseFields(ownerId, newId()),
        questionId: question.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        position: index,
        explanation: opt.explanation ?? null,
      };
      options.push(option);
      enqueue("questionOptions", option.id, option);
    });

    const state: QuestionState = {
      ...baseFields(ownerId, newId()),
      questionId: question.id,
      ...initialSrsState(),
      lastReviewedAt: null,
      isFlagged: false,
      isHighlighted: item.isHighlighted ?? false,
      notes: "",
      timesSeen: 0,
      timesCorrect: 0,
      timesWrong: 0,
      lastResult: null,
    };
    states.push(state);
    enqueue("questionStates", state.id, state);
  }

  await db.transaction(
    "rw",
    db.questions,
    db.questionOptions,
    db.questionStates,
    db.syncQueue,
    async () => {
      await db.questions.bulkAdd(questions);
      await db.questionOptions.bulkAdd(options);
      await db.questionStates.bulkAdd(states);
      await db.syncQueue.bulkAdd(queueItems as SyncQueueItem[]);
    },
  );

  return { questionsCreated: questions.length, optionsCreated: options.length };
}

export async function updateQuestion(
  id: string,
  patch: { prompt?: string; explanation?: string | null; categoryId?: string },
): Promise<void> {
  await updateRow<Question>("questions", id, patch);
}

export async function deleteQuestion(id: string): Promise<void> {
  const db = getDatabase();
  const options = await db.questionOptions.where("questionId").equals(id).toArray();
  for (const opt of options) {
    await softDeleteRow("questionOptions", opt.id);
  }
  const states = await db.questionStates.where("questionId").equals(id).toArray();
  for (const state of states) {
    await softDeleteRow("questionStates", state.id);
  }
  await softDeleteRow("questions", id);
}

export async function listQuestionsByCategoryIds(
  ownerId: string,
  categoryIds: string[],
): Promise<Question[]> {
  const db = getDatabase();
  const all = await db.questions
    .where("ownerId")
    .equals(ownerId)
    .filter((q) => q.deletedAt === null && categoryIds.includes(q.categoryId))
    .toArray();
  return all;
}

export async function listOptionsForQuestion(questionId: string): Promise<QuestionOption[]> {
  const db = getDatabase();
  return db.questionOptions
    .where("questionId")
    .equals(questionId)
    .filter((o) => o.deletedAt === null)
    .sortBy("position");
}

export async function listOptionsForQuestions(
  questionIds: string[],
): Promise<Map<string, QuestionOption[]>> {
  const db = getDatabase();
  const all = await db.questionOptions
    .where("questionId")
    .anyOf(questionIds)
    .filter((o) => o.deletedAt === null)
    .toArray();
  const map = new Map<string, QuestionOption[]>();
  for (const opt of all) {
    const list = map.get(opt.questionId) ?? [];
    list.push(opt);
    map.set(opt.questionId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position);
  return map;
}
