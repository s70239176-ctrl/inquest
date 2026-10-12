/**
 * The UI refuses to create a bounty until the rubric carries four labeled, non-empty sections.
 * (The contract only freezes the text; the structure is a UI rule, per the product spec.)
 */
export const RUBRIC_SECTIONS = ["In scope", "Out of scope", "Duplicates", "Severity bars"] as const;
export type RubricSection = (typeof RUBRIC_SECTIONS)[number];

export const MAX_RUBRIC = 6000;

export type RubricParts = Record<RubricSection, string>;

export function emptyRubric(): RubricParts {
  return { "In scope": "", "Out of scope": "", Duplicates: "", "Severity bars": "" };
}

/** Joins the four sections into the single frozen string the contract stores. */
export function composeRubric(parts: RubricParts): string {
  return RUBRIC_SECTIONS.map((s) => `${s}: ${parts[s].trim()}`).join("\n\n");
}

export function missingSections(parts: RubricParts): RubricSection[] {
  return RUBRIC_SECTIONS.filter((s) => parts[s].trim() === "");
}

/** Reads a stored rubric back into labeled sections for display. Unlabeled text is shown whole. */
export function splitRubric(text: string): { label: string; body: string }[] {
  const labels = RUBRIC_SECTIONS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(${labels})\\s*:`, "gi");
  const marks: { label: string; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) marks.push({ label: m[1], start: m.index, bodyStart: m.index + m[0].length });
  if (marks.length === 0) return [{ label: "Rubric", body: text.trim() }];
  return marks.map((mk, i) => ({
    label: RUBRIC_SECTIONS.find((s) => s.toLowerCase() === mk.label.toLowerCase()) ?? mk.label,
    body: text.slice(mk.bodyStart, marks[i + 1]?.start ?? text.length).trim(),
  }));
}
