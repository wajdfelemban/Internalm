import { getDatabase } from "../db/dexie";
import { newId } from "../lib/id";
import type { Question, QuestionOption } from "../db/schema";
import { baseFields, insertRow, softDeleteRow, updateRow } from "./base";
import { createQuestionState } from "./questionStateRepo";

export interface NewOptionInput {
  text: string;
  isCorrect: boolean;
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
    };
    await insertRow("questionOptions", row);
    optionRows.push(row);
  }

  // Every question gets a per-user SRS/study state row up front so it shows
  // up in "Unseen"/"Smart" pools immediately.
  await createQuestionState(ownerId, question.id);

  return { question, options: optionRows };
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
