import nlp from "compromise";

export type YoEContext = "required" | "preferred" | "unknown";
export interface YoEResult {
  status: "found" | "not_found";
  value?: string;
  context?: YoEContext;
  score?: number;
}

export interface DegreeResult {
  status: "found" | "not_found";
  values?: string[];
  equiv?: boolean;
}

const REQUIRED_MARKERS = ["minimum", "required", "must have", "essential"];
const PREFERRED_MARKERS = [
  "preferred",
  "desired",
  "ideal",
  "nice to have",
  "plus",
];

const EXPERIENCE_MARKERS = [
  "experience",
  "exp",
  "professional",
  "industry",
  "work",
  "relevant",
];

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  dozen: 12,
};

const DEGREE_SYNONYMS: Record<string, string> = {
  "Associate's": "associate(?:'s)?|associates?\\s+degree|diploma",
  "Bachelor's": "bachelor(?:'s)?|ba|bs|bsc|basc|beng|btech|be",
  "Master's": "master(?:'s)?|ma|ms|msc|meng|mtech",
  MBA: "m\\.b\\.a|mba",
  JD: "j\\.d\\.|jd|juris\\s+doctor",
  PhD: "phd|doctorate|doctor\\s+of\\s+philosophy|dphil",
};

const FALSE_POSITIVE_TOKENS = [
  "ago",
  "old",
  "story",
  "history",
  "program",
  "course",
  "anniversary",
  "recognition",
  "clioversary",
];

function normalise(text: string): string {
  return text.toLowerCase();
}

function windowHas(tokens: string[], words: string[]): boolean {
  return words.some((w) => tokens.includes(w));
}

export function extractYoE(description: string): YoEResult {
  const doc = nlp(description);
  const terms = doc.terms().json();

  let best: YoEResult = { status: "not_found" };

  terms.forEach((term, idx) => {
    let raw = term.text.trim();
    raw = raw.replace(/[.,;:]+$/, "");
    const lower = raw.toLowerCase();

    let numericStr: string | null = null;
    let numericVal: number | null = null;

    if (/^\d/.test(raw)) {
      numericStr = raw;
      numericVal = parseFloat(raw);
    } else if (WORD_NUMBERS[lower] !== undefined) {
      numericVal = WORD_NUMBERS[lower];
      numericStr = numericVal.toString();
    } else {
      return;
    }

    const next = terms[idx + 1]?.text || "";
    if (/^[+]/.test(next)) {
      numericStr += "+";
    } else if (/^[\-]/.test(next)) {
      const rangeSecond = terms[idx + 2]?.text || "";
      const rangeNum = /^\d/.test(rangeSecond)
        ? rangeSecond
        : WORD_NUMBERS[rangeSecond.toLowerCase()]?.toString();
      if (rangeNum) numericStr += "-" + rangeNum;
    }

    const contextTokens = terms
      .slice(Math.max(0, idx - 6), idx + 8)
      .map((t) => t.text.toLowerCase());

    const prevTokens = terms
      .slice(Math.max(0, idx - 4), idx)
      .map((t) => t.text.toLowerCase());

    const nextTokens = terms
      .slice(idx + 1, idx + 5)
      .map((t) => t.text.toLowerCase());

    const hasExperienceNearby =
      windowHas(contextTokens, EXPERIENCE_MARKERS) ||
      windowHas(prevTokens, EXPERIENCE_MARKERS) ||
      windowHas(nextTokens, EXPERIENCE_MARKERS);

    if (!hasExperienceNearby) return;
    if (windowHas(contextTokens, FALSE_POSITIVE_TOKENS)) return;

    let score = 1;
    if (windowHas(contextTokens, REQUIRED_MARKERS)) score += 10;
    else if (windowHas(contextTokens, PREFERRED_MARKERS)) score += 5;

    if (numericVal !== null && numericVal <= 3) score += 2;

    if (score > (best.score ?? 0)) {
      best = {
        status: "found",
        value: numericStr + " yrs",
        context: windowHas(contextTokens, REQUIRED_MARKERS)
          ? "required"
          : windowHas(contextTokens, PREFERRED_MARKERS)
          ? "preferred"
          : "unknown",
        score,
      };
    }
  });

  return best;
}

export function extractDegrees(description: string): DegreeResult {
  const text = normalise(description);
  const found = new Set<string>();

  for (const [norm, pattern] of Object.entries(DEGREE_SYNONYMS)) {
    const re = new RegExp(`\\b(?:${pattern})\\b`, "i");
    if (re.test(text)) found.add(norm);
  }

  if (!found.size) return { status: "not_found" };

  const firstDegRegex =
    /associate|bachelor|master|mba|phd|j\\.d|jd|juris\\s+doctor/i;
  const firstIdx = text.search(firstDegRegex);
  const slice = text.slice(Math.max(0, firstIdx - 50), firstIdx + 100);
  const equiv = /equivalent|relevant work experience/.test(slice);

  return { status: "found", values: [...found], equiv };
}
