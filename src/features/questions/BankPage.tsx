import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDatabase } from "../../db/dexie";
import { useAuthStore } from "../../state/authStore";
import { CategoryTree } from "../categories/CategoryTree";
import { QuestionForm } from "./QuestionForm";
import {
  categoryAndDescendantIds,
  createCategory,
  deleteCategory,
  renameCategory,
} from "../../repositories/categoriesRepo";
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from "../../repositories/questionsRepo";
import type { NewOptionInput } from "../../repositories/questionsRepo";
import type { QuestionOption } from "../../db/schema";

export function BankPage() {
  const ownerId = useAuthStore((s) => s.user!.id);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const categories = useLiveQuery(
    () =>
      getDatabase()
        .categories.where("ownerId")
        .equals(ownerId)
        .filter((c) => c.deletedAt === null)
        .sortBy("position"),
    [ownerId],
    [],
  );

  const scopedCategoryIds = selectedCategoryId
    ? categoryAndDescendantIds(categories ?? [], selectedCategoryId)
    : (categories ?? []).map((c) => c.id);

  const questions = useLiveQuery(
    () =>
      getDatabase()
        .questions.where("ownerId")
        .equals(ownerId)
        .filter((q) => q.deletedAt === null && scopedCategoryIds.includes(q.categoryId))
        .toArray(),
    [ownerId, JSON.stringify(scopedCategoryIds)],
    [],
  );

  const optionsByQuestion = useLiveQuery(
    async () => {
      const db = getDatabase();
      const ids = (questions ?? []).map((q) => q.id);
      const map = new Map<string, QuestionOption[]>();
      if (ids.length === 0) return map;
      const rows = await db.questionOptions
        .where("questionId")
        .anyOf(ids)
        .filter((o) => o.deletedAt === null)
        .toArray();
      for (const r of rows) map.set(r.questionId, [...(map.get(r.questionId) ?? []), r]);
      return map;
    },
    [JSON.stringify((questions ?? []).map((q) => q.id))],
    new Map<string, QuestionOption[]>(),
  );

  const categoryCount = (categoryId: string) => {
    const ids = categoryAndDescendantIds(categories ?? [], categoryId);
    return (questions ?? []).filter((q) => ids.includes(q.categoryId)).length;
  };

  async function handleAddQuestion(
    prompt: string,
    explanation: string | null,
    options: NewOptionInput[],
  ) {
    const categoryId = selectedCategoryId ?? categories?.[0]?.id;
    if (!categoryId) return;
    await createQuestion(ownerId, categoryId, prompt, explanation, options);
    setShowForm(false);
  }

  async function handleEditQuestion(
    id: string,
    prompt: string,
    explanation: string | null,
  ) {
    await updateQuestion(id, { prompt, explanation });
    setEditingQuestionId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <CategoryTree
        categories={categories ?? []}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        onAddTopLevel={(name) => createCategory(ownerId, name)}
        onAddSub={(parentId, name) => createCategory(ownerId, name, parentId)}
        onRename={(id, name) => renameCategory(id, name)}
        onDelete={(id) => deleteCategory(id)}
        countFor={categoryCount}
      />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {selectedCategoryId
              ? categories?.find((c) => c.id === selectedCategoryId)?.name
              : "All questions"}
          </h2>
          {categories && categories.length > 0 && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {showForm ? "Close" : "+ Add question"}
            </button>
          )}
        </div>

        {(!categories || categories.length === 0) && (
          <p className="text-sm text-gray-500">Create a category first, then add questions to it.</p>
        )}

        {showForm && categories && categories.length > 0 && (
          <div className="mb-4">
            <QuestionForm
              categoryName={
                categories.find((c) => c.id === (selectedCategoryId ?? categories[0].id))?.name ?? ""
              }
              onCancel={() => setShowForm(false)}
              onSubmit={handleAddQuestion}
            />
          </div>
        )}

        <ul className="space-y-2">
          {(questions ?? []).map((q) => {
            const opts = optionsByQuestion?.get(q.id) ?? [];
            const isEditing = editingQuestionId === q.id;
            return (
              <li
                key={q.id}
                className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
              >
                {isEditing ? (
                  <QuestionForm
                    categoryName={categories?.find((c) => c.id === q.categoryId)?.name ?? ""}
                    initialPrompt={q.prompt}
                    initialExplanation={q.explanation ?? ""}
                    initialOptions={opts.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))}
                    onCancel={() => setEditingQuestionId(null)}
                    onSubmit={(prompt, explanation) => handleEditQuestion(q.id, prompt, explanation)}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.prompt}</p>
                      <div className="flex shrink-0 gap-2 text-xs">
                        <button
                          onClick={() => setEditingQuestionId(q.id)}
                          className="text-gray-400 hover:text-indigo-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirm("Delete this question?") && deleteQuestion(q.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {opts.map((o) => (
                        <li
                          key={o.id}
                          className={`text-xs ${
                            o.isCorrect
                              ? "font-medium text-green-700 dark:text-green-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {o.isCorrect ? "✓ " : "· "}
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {questions && questions.length === 0 && categories && categories.length > 0 && (
          <p className="text-sm text-gray-500">No questions yet in this scope.</p>
        )}
      </div>
    </div>
  );
}
