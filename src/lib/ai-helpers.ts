// Lightweight NLP-ish helpers used to make the local AI simulations
// feel specific to the user's input instead of templated.

export const DISCLAIMER =
  "AI-generated draft. Please review for accuracy, tone, and context before sharing.";

export const NOT_SPECIFIED = "Not specified";

export const cleanText = (s: string) => s.replace(/\s+/g, " ").trim();

export const splitSentences = (text: string): string[] =>
  text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
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
const RISK_RE = /\b(risk|blocker|blocked|concern|issue|delay|dependency|waiting|awaiting|stuck|unclear|unknown|gap)\b/i;

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

// Try to find a deadline reference in a sentence and normalize.
export const extractDeadline = (s: string): string | null => {
  const explicit =
    s.match(/\bby\s+([A-Z][a-z]+(?:\s+\d{1,2})?(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i) ??
    s.match(/\b(today|tomorrow|tonight|this week|next week|end of week|EOW|EOD|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  return explicit ? explicit[1] : null;
};

// Try to find an owner: "Sarah will ...", "owner: Diego", "@diego"
export const extractOwner = (s: string, candidates: string[]): string | null => {
  for (const c of candidates) {
    const re = new RegExp(`\\b${c.split(/\s+/)[0]}\\b`, "i");
    if (re.test(s)) return c;
  }
  const owner = s.match(/owner:\s*([A-Z][a-zA-Z]+)/i) ?? s.match(/@([a-zA-Z]+)/);
  return owner ? owner[1] : null;
};

export const titleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// Turn a sentence into an imperative task ("Sarah will finalize wireframes" -> "Finalize wireframes")
export const toImperative = (s: string): string => {
  let t = s.replace(/\.$/, "");
  t = t.replace(/^[A-Z][a-zA-Z]+\s+(will|to|should|needs to|must)\s+/i, "");
  t = t.replace(/^(we|i|they|the team)\s+(will|need to|should|must)\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const inDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
