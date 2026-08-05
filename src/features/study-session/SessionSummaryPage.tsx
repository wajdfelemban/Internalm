import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { getDatabase } from "../../db/dexie";
import { sessionAccuracy } from "../../repositories/sessionsRepo";

export function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const session = useLiveQuery(() => getDatabase().studySessions.get(sessionId!), [sessionId]);
  const answers = useLiveQuery(
    () => (sessionId ? getDatabase().sessionAnswers.where("sessionId").equals(sessionId).toArray() : []),
    [sessionId],
    [],
  );
  const questions = useLiveQuery(
    async () => {
      if (!answers || answers.length === 0) return new Map();
      const rows = await getDatabase().questions.bulkGet(answers.map((a) => a.questionId));
      return new Map(rows.filter(Boolean).map((q) => [q!.id, q!]));
    },
    [JSON.stringify((answers ?? []).map((a) => a.questionId))],
    new Map(),
  );

  if (!session) return <p className="text-sm text-gray-500">Loading…</p>;

  const accuracy = sessionAccuracy(session);
  const wrongAnswers = (answers ?? []).filter((a) => !a.isCorrect);

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-4 text-lg font-semibold">Session complete</h2>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{accuracy}%</div>
        <p className="mt-1 text-sm text-gray-500">
          {session.correctCount} / {session.totalCount} correct
        </p>
      </div>

      {wrongAnswers.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Missed questions
          </h3>
          <ul className="space-y-1">
            {wrongAnswers.map((a) => (
              <li key={a.id} className="text-sm text-gray-600 dark:text-gray-400">
                · {questions?.get(a.questionId)?.prompt ?? a.questionId}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Link
          to="/study"
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
        >
          Study again
        </Link>
        <Link
          to="/stats"
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          View stats
        </Link>
      </div>
    </div>
  );
}
