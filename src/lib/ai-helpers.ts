// Lightweight NLP-ish helpers used to make the local AI simulations
// feel specific to the user's input instead of templated.

export const DISCLAIMER =
  "AI-generated draft. Please review for accuracy, tone, and context before sharing.";

export const NOT_SPECIFIED = "Not specified";

export const cleanText = (s: string) => s.replace(/\s+/g, " ").trim();

export const splitSentences = (text: string): string[] =>
  text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+(?=[A-Z(])|\n+/)
    .map((s) => cleanText(s.replace(/^[-•*\d.)\s]+/, "")))
    .filter((s) => s.length > 2);

const STOP = new Set(
  "the a an of to in on for and or but with by at as is are was were be been being this that these those it its their our your we they i he she them us his her have has had do does did will would could should may might can not no yes if then than so just about into over under from up down out off again very more most some any all each every other another such own same".split(
    " ",
  ),
);

export const keywords = (text: string, max = 8): string[] => {
  const freq = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9'-]+/)) {
    const w = raw.trim();
    if (!w || w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
};

// Extract probable proper-noun mentions (capitalized tokens not at sentence start only)
export const properNouns = (text: string): string[] => {
  const found = new Set<string>();
  const matches = text.match(/\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\b/g) ?? [];
  for (const m of matches) {
    if (!STOP.has(m.toLowerCase())) found.add(m);
  }
  return [...found];
};

const DECISION_RE = /\b(decided|agreed|approved|chose|will ship|going with|locked in|signed off|move forward|greenlit)\b/i;
const ACTION_RE = /\b(will|to|should|need to|needs to|must|owns?|own|take|follow ?up|send|prepare|draft|review|finalize|schedule|build|ship|investigate|sync|confirm|update|share)\b/i;
const RISK_RE = /\b(risk|blocker|blocked|concern|issue|delay|delayed|slipping|slip|behind|dependency|waiting|awaiting|stuck|unclear|unknown|gap|pending|missing|outage|bug)\b/i;

export const classifySentences = (sentences: string[]) => {
  const decisions: string[] = [];
  const actions: string[] = [];
  const risks: string[] = [];
  const points: string[] = [];

  for (const s of sentences) {
    if (DECISION_RE.test(s)) decisions.push(s);
    else if (RISK_RE.test(s)) risks.push(s);
    else if (ACTION_RE.test(s)) actions.push(s);
    else points.push(s);
  }
  return { decisions, actions, risks, points };
};

const WEEKDAYS = "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thurs|Fri|Sat|Sun)";
const TIME_OF_DAY = "(?:\\s+(?:morning|afternoon|evening|night))?";
const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";

// Ordered: most specific first. Returns the exact phrase from input.
const DEADLINE_PATTERNS: RegExp[] = [
  new RegExp(`\\bby\\s+(end\\s+of\\s+(?:the\\s+)?(?:week|day|month|quarter|sprint))\\b`, "i"),
  new RegExp(`\\bby\\s+(next\\s+${WEEKDAYS}${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\bby\\s+(this\\s+${WEEKDAYS}${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\bby\\s+(${WEEKDAYS}${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\bby\\s+(${MONTH}\\s+\\d{1,2}(?:,\\s*\\d{4})?)\\b`, "i"),
  new RegExp(`\\bby\\s+(\\d{4}-\\d{2}-\\d{2})\\b`),
  new RegExp(`\\bby\\s+(\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)\\b`),
  new RegExp(`\\b(next\\s+(?:week|${WEEKDAYS})${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\b(this\\s+(?:week|${WEEKDAYS})${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\b(end\\s+of\\s+(?:the\\s+)?(?:week|day|month|quarter|sprint))\\b`, "i"),
  new RegExp(`\\b(tomorrow${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\b(tonight|today|EOW|EOD)\\b`, "i"),
  new RegExp(`\\b(${WEEKDAYS}${TIME_OF_DAY})\\b`, "i"),
  new RegExp(`\\b(${MONTH}\\s+\\d{1,2}(?:,\\s*\\d{4})?)\\b`, "i"),
];

export const extractDeadline = (s: string): string | null => {
  for (const re of DEADLINE_PATTERNS) {
    const m = s.match(re);
    if (m) return cleanText(m[1]);
  }
  return null;
};

// Try to find an owner: "Sarah will ...", "owner: Diego", "@diego"
export const extractOwner = (s: string, candidates: string[]): string | null => {
  for (const c of candidates) {
    const first = c.split(/\s+/)[0];
    const re = new RegExp(`\\b${first}\\b`, "i");
    if (re.test(s)) return c;
  }
  const owner = s.match(/owner:\s*([A-Z][a-zA-Z]+)/i) ?? s.match(/@([a-zA-Z]+)/);
  return owner ? owner[1] : null;
};

export const titleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// Turn a sentence into an imperative task ("Sarah will finalize wireframes by Friday" -> "Finalize wireframes by Friday")
export const toImperative = (s: string): string => {
  let t = s.replace(/\.$/, "").trim();
  // Strip "<Name> will/needs to/should/must "
  t = t.replace(/^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\s+(will|to|should|needs?\s+to|must|is\s+going\s+to)\s+/i, "");
  // Strip "We/I/They/The team will ..."
  t = t.replace(/^(we|i|they|the team)\s+(will|need\s+to|should|must)\s+/i, "");
  // Strip "Action: " prefixes
  t = t.replace(/^(action|todo|to-do|task)\s*[:\-]\s*/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Extract the "topic" of a sentence — strip leading subject + auxiliary verb,
// so we can list real topics in summaries instead of dumping single keywords.
export const sentenceTopic = (s: string): string => {
  let t = s.replace(/\.$/, "").trim();
  t = t.replace(/^(we|i|they|the team|everyone|all|also)\s+/i, "");
  t = t.replace(/^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\s+(will|to|should|needs?\s+to|must|raised|flagged|mentioned|noted|reported|said)\s+/i, "");
  t = t.replace(/^(discussed|reviewed|covered|talked about|went over|walked through)\s+/i, "");
  return t.trim();
};

export const inDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// Join an array of phrases as a natural English list.
export const naturalList = (items: string[]): string => {
  const a = items.filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
};

export const dedupe = <T,>(arr: T[], key: (x: T) => string = (x) => String(x)): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it).toLowerCase().trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
};
