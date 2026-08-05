import Papa from "papaparse";
import type { NewOptionInput } from "../../repositories/questionsRepo";

export interface ParsedImportItem {
  categoryName: string;
  subcategoryName: string | null;
  prompt: string;
  explanation: string | null;
  isHighlighted: boolean;
  options: NewOptionInput[];
}

export interface ImportParseResult {
  items: ParsedImportItem[];
  skipped: number;
  totalRows: number;
  categoryCounts: Map<string, number>;
}

// A handful of near-duplicate subcategory spellings seen in real exports —
// merged so the category tree doesn't end up with e.g. both "General" and
// "General Internal Medicine" as separate near-empty siblings.
const SUBCATEGORY_ALIASES: Record<string, string> = {
  "general internal medicine": "General",
  immunology: "Allergy/Immunology",
};

function normalizeSubcategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "General";
  return SUBCATEGORY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

type AnswerLetter = "A" | "B" | "C" | "D";

function extractAnswerLetter(raw: string): AnswerLetter | null {
  const match = raw.trim().match(/^[ABCD]/i);
  return match ? (match[0].toUpperCase() as AnswerLetter) : null;
}

// Filters out generic "Accurate." acknowledgements, keeping only
// substantive caveats worth surfacing as a study note.
function isMeaningfulNote(text: string): boolean {
  const cleaned = text.trim().replace(/[.\s]+$/, "").toLowerCase();
  return cleaned.length > 0 && cleaned !== "accurate" && cleaned !== "answer is medically accurate";
}

function buildQuestionExplanation(row: Record<string, string>): string | null {
  const parts: string[] = [];
  const oneLine = row.One_Line?.trim();
  const highYield = row.High_Yield_Must_Know?.trim();
  const accuracyReview = row.Accuracy_Review?.trim();

  if (oneLine) parts.push(oneLine);
  if (highYield) parts.push(highYield);
  if (accuracyReview && isMeaningfulNote(accuracyReview)) parts.push(`Note: ${accuracyReview}`);

  return parts.length ? parts.join("\n\n") : null;
}

/**
 * Parses a CSV in the "SMLE-style" question-bank format: Question,
 * Option_A..D, Answer (a letter, optionally followed by the option text),
 * Category, subcategory, Highlighted, Explanation_A..D,
 * High_Yield_Must_Know, One_Line, Accuracy_Review.
 */
export function parseQuestionBankCsv(csvText: string): ImportParseResult {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const items: ParsedImportItem[] = [];
  const categoryCounts = new Map<string, number>();
  let skipped = 0;

  for (const row of data) {
    const prompt = row.Question?.trim();
    const category = row.Category?.trim();
    if (!prompt || !category) {
      skipped += 1;
      continue;
    }

    const letter = extractAnswerLetter(row.Answer ?? "");
    const optionDefs: Array<{ letter: AnswerLetter; text: string; explanation: string }> = (
      ["A", "B", "C", "D"] as AnswerLetter[]
    )
      .map((l) => ({
        letter: l,
        text: row[`Option_${l}`]?.trim() ?? "",
        explanation: row[`Explanation_${l}`]?.trim() ?? "",
      }))
      .filter((o) => o.text.length > 0);

    if (optionDefs.length < 2 || !letter || !optionDefs.some((o) => o.letter === letter)) {
      skipped += 1;
      continue;
    }

    const highlightedRaw = (row.Highlighted ?? "").trim().toLowerCase();
    const isHighlighted = highlightedRaw === "highlighted" || highlightedRaw.startsWith("yes");

    const subcategoryName = row.subcategory ? normalizeSubcategory(row.subcategory) : null;

    items.push({
      categoryName: category,
      subcategoryName,
      prompt,
      explanation: buildQuestionExplanation(row),
      isHighlighted,
      options: optionDefs.map((o) => ({
        text: o.text,
        isCorrect: o.letter === letter,
        explanation: o.explanation || null,
      })),
    });

    const key = subcategoryName ? `${category} / ${subcategoryName}` : category;
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }

  return { items, skipped, totalRows: data.length, categoryCounts };
}
