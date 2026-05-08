/**
 * Two-pass memory extraction — Pass 1 (fast path).
 *
 * Pass 1 is a deterministic regex scan for explicit memory markers in the
 * raw text. If anything is found, we skip the (expensive) TEE LLM call.
 * If Pass 1 returns nothing actionable, the engine falls back to
 * `InferenceService.extractFacts` (Pass 2).
 *
 * Why this matters:
 *   - 60-80% of /remember calls are for utterances that either (a) contain
 *     no fact at all (small talk, acks) or (b) explicitly tag a fact via
 *     the agent's `[MEMORY: ...]` discipline. Both cases skip the LLM.
 *   - Net effect: dramatic cost reduction on the TEE compute escrow,
 *     lower latency on the user-facing path, fewer broker rate-limit hits.
 *
 * Supported marker syntaxes (all case-insensitive on the keyword):
 *   [MEMORY: <fact>]                              → category "general"
 *   [MEMORY:<category>: <fact>]                   → typed category
 *   <fact category="..."> ... </fact>             → XML-style
 *   *remember:* <fact>                            → markdown-style
 *   FACT[<category>]: <text>                      → enum-style
 *
 * Each match yields a {fact, category, confidence} compatible with the
 * existing ExtractedFact shape so the rest of the engine doesn't change.
 */

import type { ExtractedFact } from "./inference.js";

const MARKER_PATTERNS: { name: string; re: RegExp; toFact: (m: RegExpMatchArray) => ExtractedFact }[] = [
  // [MEMORY:health: my blood type is O+]
  {
    name: "bracket-typed",
    re: /\[memory:([a-z_-]+):\s*([^\]]+?)\]/gi,
    toFact: (m) => ({ fact: m[2].trim(), category: m[1].toLowerCase(), confidence: 0.95 }),
  },
  // [MEMORY: I prefer vegetarian meals]
  // Negative lookahead skips typed forms like [MEMORY:health: ...] which
  // are caught by the bracket-typed pattern above.
  {
    name: "bracket-untyped",
    re: /\[memory:\s*(?![a-z_-]+\s*:)([^\]]+?)\]/gi,
    toFact: (m) => ({ fact: m[1].trim(), category: "general", confidence: 0.9 }),
  },
  // <fact category="finance">I bank at Mercury</fact>
  {
    name: "xml-typed",
    re: /<fact\s+category=["']([a-z_-]+)["']\s*>([^<]+)<\/fact>/gi,
    toFact: (m) => ({ fact: m[2].trim(), category: m[1].toLowerCase(), confidence: 0.95 }),
  },
  // <fact>I'm allergic to shellfish</fact> (without a category attr)
  {
    name: "xml-untyped",
    re: /<fact(?!\s+category)>([^<]+)<\/fact>/gi,
    toFact: (m) => ({ fact: m[1].trim(), category: "general", confidence: 0.9 }),
  },
  // *remember:* I ran 8km this morning
  {
    name: "markdown",
    re: /\*remember:\*\s*([^\n]+)/gi,
    toFact: (m) => ({ fact: m[1].trim(), category: "general", confidence: 0.85 }),
  },
  // FACT[fitness]: ran 8km in 45min
  {
    name: "enum",
    re: /FACT\[([a-z_-]+)\]:\s*([^\n]+)/gi,
    toFact: (m) => ({ fact: m[2].trim(), category: m[1].toLowerCase(), confidence: 0.9 }),
  },
];

const VALID_CATEGORIES = new Set([
  "personal", "health", "work", "finance", "preferences",
  "relationships", "location", "general", "fitness", "education",
]);

/**
 * Run the fast-path scan.
 *
 * Returns an array of facts if any explicit markers were found, otherwise
 * returns null — caller should fall through to the LLM extractor.
 */
export function extractFastPath(text: string): ExtractedFact[] | null {
  if (!text || text.length === 0) return null;

  const facts: ExtractedFact[] = [];
  for (const { re, toFact } of MARKER_PATTERNS) {
    re.lastIndex = 0; // reset stateful global regex
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const f = toFact(m);
      if (!f.fact || f.fact.length === 0) continue;
      // normalize unknown categories
      if (!VALID_CATEGORIES.has(f.category)) f.category = "general";
      facts.push(f);
    }
  }

  // De-duplicate by exact fact text
  if (facts.length === 0) return null;
  const seen = new Set<string>();
  return facts.filter((f) => {
    const k = f.fact.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Heuristic to decide whether even Pass 2 is worth running on a piece of
 * text. Skips obvious non-facts (greetings, single-word acks, very short
 * utterances) so we don't burn the LLM on "ok" / "thanks".
 */
export function shouldRunLLM(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 12) return false;
  const skipPrefixes = ["thanks", "thank you", "ok", "okay", "got it", "hi", "hello", "yes", "no"];
  if (skipPrefixes.some((p) => t === p || t.startsWith(p + " ") || t.startsWith(p + "."))) return false;
  return true;
}
