import { useState } from "react";
import type { NewOptionInput } from "../../repositories/questionsRepo";

interface Props {
  categoryName: string;
  initialPrompt?: string;
  initialExplanation?: string;
  initialOptions?: NewOptionInput[];
  onCancel: () => void;
  onSubmit: (prompt: string, explanation: string | null, options: NewOptionInput[]) => Promise<void>;
}

export function QuestionForm({
  categoryName,
  initialPrompt = "",
  initialExplanation = "",
  initialOptions,
  onCancel,
  onSubmit,
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [options, setOptions] = useState<NewOptionInput[]>(
    initialOptions ?? [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, patch: Partial<NewOptionInput>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function setCorrect(index: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));
  }

  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!prompt.trim()) return setError("Question prompt is required.");
    const cleanOptions = options.filter((o) => o.text.trim().length > 0);
    if (cleanOptions.length < 2) return setError("Add at least 2 answer options.");
    if (!cleanOptions.some((o) => o.isCorrect)) return setError("Mark one option as correct.");

    setSaving(true);
    try {
      await onSubmit(prompt.trim(), explanation.trim() || null, cleanOptions);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 text-xs uppercase tracking-wide text-gray-400">{categoryName}</p>

      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Question
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Answer options (select the correct one)
      </label>
      <div className="mb-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-option"
              checked={opt.isCorrect}
              onChange={() => setCorrect(i)}
              className="h-4 w-4 accent-indigo-600"
            />
            <input
              value={opt.text}
              onChange={(e) => updateOption(i, { text: e.target.value })}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(i)}
                className="px-1 text-gray-400 hover:text-red-600"
                title="Remove option"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button onClick={addOption} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            + Add option
          </button>
        )}
      </div>

      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Explanation (optional)
      </label>
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
      />

      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save question"}
        </button>
      </div>
    </div>
  );
}
