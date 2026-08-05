import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDatabase } from "../../db/dexie";
import { useAuthStore } from "../../state/authStore";
import { listSessions, overallAccuracy, poolCounts, sessionAccuracy } from "../../repositories/sessionsRepo";
import { POOL_FILTER_LABELS } from "../../db/schema";

export function StatsPage() {
  const ownerId = useAuthStore((s) => s.user!.id);

  const categories = useLiveQuery(
    () =>
      getDatabase()
        .categories.where("ownerId")
        .equals(ownerId)
        .filter((c) => c.deletedAt === null)
        .toArray(),
    [ownerId],
    [],
  );

  const sessions = useLiveQuery(() => listSessions(ownerId), [ownerId], []);

  const [overall, setOverall] = useState<{ correct: number; total: number; accuracy: number } | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    overallAccuracy(ownerId).then(setOverall);
  }, [ownerId, sessions?.length]);

  useEffect(() => {
    const allCategoryIds = (categories ?? []).map((c) => c.id);
    poolCounts(ownerId, allCategoryIds).then(setCounts);
  }, [ownerId, JSON.stringify((categories ?? []).map((c) => c.id))]);

  const categoryName = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? "All categories";

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Statistics &amp; progress</h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {overall ? `${overall.accuracy}%` : "—"}
          </div>
          <div className="text-xs text-gray-500">Overall accuracy</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {overall ? overall.total : "—"}
          </div>
          <div className="text-xs text-gray-500">Questions answered</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {sessions?.length ?? 0}
          </div>
          <div className="text-xs text-gray-500">Sessions completed</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {counts ? counts.smart : "—"}
          </div>
          <div className="text-xs text-gray-500">Due + new right now</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
            {counts && counts.all > 0 ? `${Math.round((counts.mastered / counts.all) * 100)}%` : "—"}
          </div>
          <div className="text-xs text-gray-500">
            Mastered index{counts ? ` (${counts.mastered}/${counts.all})` : ""}
          </div>
        </div>
      </div>

      {counts && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Question pool</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(POOL_FILTER_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts[key]}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Session history</h3>
        {sessions && sessions.length === 0 && (
          <p className="text-sm text-gray-500">No completed sessions yet.</p>
        )}
        <ul className="space-y-2">
          {(sessions ?? []).map((s) => {
            const acc = sessionAccuracy(s);
            return (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-gray-900 dark:text-gray-100">{categoryName(s.categoryId)}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(s.startedAt).toLocaleString()} · {POOL_FILTER_LABELS[s.poolFilter]}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className={`h-full ${acc >= 70 ? "bg-green-500" : acc >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-medium text-gray-700 dark:text-gray-300">{acc}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
