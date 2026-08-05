import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuthStore } from "../../state/authStore";
import { useStudySessionStore } from "../../state/studySessionStore";
import {
  getStateForQuestion,
  recordAnswer,
  setNotes,
  tagsForState,
  toggleFlag,
  toggleHighlight,
} from "../../repositories/questionStateRepo";
import { completeSession, recordSessionAnswer, sessionAccuracy } from "../../repositories/sessionsRepo";

const TAG_STYLES: Record<string, string> = {
  New: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  Due: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
  Wrong: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
  Flagged: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  Highlighted: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300",
};

export function StudySessionPage() {
  const ownerId = useAuthStore((s) => s.user!.id);
  const navigate = useNavigate();
  const {
    session,
    questions,
    optionsByQuestion,
    currentIndex,
    answers,
    next,
    back,
    goTo,
    recordAnswerLocal,
    reset,
  } = useStudySessionStore();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [finishing, setFinishing] = useState(false);

  const question = questions[currentIndex];
  const options = question ? optionsByQuestion.get(question.id) ?? [] : [];
  const existingAnswer = question ? answers.get(question.id) : undefined;

  const state = useLiveQuery(
    () => (question ? getStateForQuestion(ownerId, question.id) : undefined),
    [ownerId, question?.id],
  );

  useEffect(() => {
    setSelectedOptionId(existingAnswer?.selectedOptionId ?? null);
    setNotesDraft(state?.notes ?? "");
    setShowNotes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  useEffect(() => {
    if (!showNotes) setNotesDraft(state?.notes ?? "");
  }, [state?.notes, showNotes]);

  if (!session || questions.length === 0 || !question) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="mb-4 text-gray-500">No active study session.</p>
        <button
          onClick={() => navigate("/study")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Set up a session
        </button>
      </div>
    );
  }

  const tags = tagsForState(state, new Date());
  const isAnswered = existingAnswer !== undefined;
  const answeredCount = answers.size;
  const runningAccuracy = sessionAccuracy({
    correctCount: [...answers.values()].filter((a) => a.isCorrect).length,
    totalCount: answers.size,
  });

  async function submitAnswer() {
    if (!state || selectedOptionId === null || isAnswered) return;
    const chosen = options.find((o) => o.id === selectedOptionId);
    const isCorrect = !!chosen?.isCorrect;

    await recordAnswer(state, isCorrect);
    await recordSessionAnswer(session!, question.id, selectedOptionId, isCorrect);
    recordAnswerLocal({ questionId: question.id, selectedOptionId, isCorrect });
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      await completeSession(session!);
      const sessionId = session!.id;
      reset();
      navigate(`/study/summary/${sessionId}`);
    } finally {
      setFinishing(false);
    }
  }

  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
        <span>
          Question {currentIndex + 1} / {questions.length}
        </span>
        <span>
          Session accuracy: {answeredCount > 0 ? `${runningAccuracy}%` : "—"} ({answeredCount} answered)
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_STYLES[tag] ?? ""}`}>
            {tag}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-base font-medium text-gray-900 dark:text-gray-100">{question.prompt}</p>
          <div className="flex shrink-0 gap-1">
            <button
              title="Flag this question"
              onClick={() => state && toggleFlag(state.id, !state.isFlagged)}
              className={`rounded-lg p-1.5 text-sm ${
                state?.isFlagged
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950"
                  : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              🚩
            </button>
            <button
              title="Highlight this question"
              onClick={() => state && toggleHighlight(state.id, !state.isHighlighted)}
              className={`rounded-lg p-1.5 text-sm ${
                state?.isHighlighted
                  ? "bg-teal-100 text-teal-600 dark:bg-teal-950"
                  : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              ★
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = selectedOptionId === opt.id;
            let style =
              "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800";
            if (isAnswered) {
              if (opt.isCorrect) style = "border-green-500 bg-green-50 dark:bg-green-950";
              else if (isSelected) style = "border-red-500 bg-red-50 dark:bg-red-950";
            } else if (isSelected) {
              style = "border-indigo-500 bg-indigo-50 dark:bg-indigo-950";
            }
            return (
              <button
                key={opt.id}
                disabled={isAnswered}
                onClick={() => setSelectedOptionId(opt.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${style}`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {isAnswered && question.explanation && (
          <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {question.explanation}
          </p>
        )}

        <div className="mt-4">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {showNotes ? "Hide notes" : "Add notes"}
          </button>
          {showNotes && (
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => state && setNotes(state.id, notesDraft)}
              placeholder="Any additional notes for this question…"
              rows={2}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={back}
          disabled={currentIndex === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← Back
        </button>

        {!isAnswered ? (
          <button
            onClick={submitAnswer}
            disabled={selectedOptionId === null}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit answer
          </button>
        ) : isLast ? (
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {finishing ? "Finishing…" : "Finish session"}
          </button>
        ) : (
          <button
            onClick={next}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Next →
          </button>
        )}
      </div>

      {questions.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {questions.map((q, i) => {
            const a = answers.get(q.id);
            let dot = "bg-gray-300 dark:bg-gray-700";
            if (a) dot = a.isCorrect ? "bg-green-500" : "bg-red-500";
            if (i === currentIndex) dot += " ring-2 ring-indigo-400 ring-offset-1";
            return (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                title={`Question ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full ${dot}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
