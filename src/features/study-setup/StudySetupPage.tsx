import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { getDatabase } from "../../db/dexie";
import { useAuthStore } from "../../state/authStore";
import { useStudySessionStore } from "../../state/studySessionStore";
import type { PoolFilter } from "../../db/schema";
import { POOL_FILTER_LABELS } from "../../db/schema";
import {
  categoryAndDescendantIds,
  topLevelCategories,
  subcategoriesOf,
} from "../../repositories/categoriesRepo";
import {
  buildQuestionPool,
  poolCounts,
  startSession,
} from "../../repositories/sessionsRepo";
import { listOptionsForQuestions } from "../../repositories/questionsRepo";

const POOL_FILTERS: PoolFilter[] = ["smart", "all", "unseen", "wrong", "flagged", "highlighted"];

export function StudySetupPage() {
  const ownerId = useAuthStore((s) => s.user!.id);
  const navigate = useNavigate();
  const begin = useStudySessionStore((s) => s.begin);

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

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("smart");
  const [count, setCount] = useState(20);
  const [counts, setCounts] = useState<Record<PoolFilter, number> | null>(null);
  const [starting, setStarting] = useState(false);

  const scopedIds = categoryId
    ? includeSub
      ? categoryAndDescendantIds(categories ?? [], categoryId)
      : [categoryId]
    : (categories ?? []).map((c) => c.id);

  useEffect(() => {
    let cancelled = false;
    poolCounts(ownerId, scopedIds).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, JSON.stringify(scopedIds)]);

  const available = counts?.[poolFilter] ?? 0;

  async function handleStart() {
    setStarting(true);
    try {
      const pool = await buildQuestionPool(ownerId, scopedIds, poolFilter, count);
      if (pool.length === 0) return;
      const session = await startSession(ownerId, categoryId, includeSub, poolFilter, count);
      const optionsMap = await listOptionsForQuestions(pool.map((q) => q.id));
      begin(session, pool, optionsMap);
      navigate("/study/session");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-4 text-lg font-semibold">Start a study session</h2>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Category
        </label>
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All categories</option>
          {topLevelCategories(categories ?? []).map((cat) => (
            <optgroup key={cat.id} label={cat.name}>
              <option value={cat.id}>{cat.name} (all)</option>
              {subcategoriesOf(categories ?? [], cat.id).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  &nbsp;&nbsp;{sub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {categoryId && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={includeSub}
              onChange={(e) => setIncludeSub(e.target.checked)}
              className="accent-indigo-600"
            />
            Include subcategories
          </label>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Question pool
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {POOL_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setPoolFilter(f)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                poolFilter === f
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              <div className="font-medium">{POOL_FILTER_LABELS[f]}</div>
              <div className="text-xs opacity-70">{counts ? counts[f] : "…"} questions</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Number of questions ({available} available)
        </label>
        <input
          type="number"
          min={1}
          max={Math.max(available, 1)}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </div>

      <button
        onClick={handleStart}
        disabled={starting || available === 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {available === 0 ? "No questions in this pool" : starting ? "Starting…" : `Start (${Math.min(count, available)} questions)`}
      </button>
    </div>
  );
}
