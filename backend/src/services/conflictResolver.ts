/**
 * Conflict resolution / supersession.
 *
 * When a new memory contradicts an old one ("I live in Tokyo" → later
 * "I moved to Berlin"), we mark the older fact as `superseded`. Recall
 * skips superseded entries so the agent never confidently parrots stale
 * information.
 *
 * Detection model:
 *   1. Embedding similarity above a high threshold (these talk about the
 *      same subject)
 *   2. Same category/tag (cuts cross-domain false positives)
 *   3. Different content (otherwise it's a duplicate, not a conflict)
 *
 * We deliberately do NOT use the LLM to detect conflicts — that would
 * defeat the cost-savings of the two-pass extractor. Embedding cosine
 * similarity + category match is good enough for the high-precision
 * cases. False negatives are acceptable (worst case = stale fact lingers
 * in recall context); false positives are NOT (would silently delete
 * valid memories).
 *
 * Supersession is non-destructive: the old record stays in storage with
 * `superseded: true`. Recall filters it out, but audit/debug paths can
 * still see it.
 */

import type { MemoryRecord } from "./memoryEngine.js";
import { embed } from "./embeddings.js";
import { VectorIndex } from "./vectorIndex.js";

// VectorIndex uses cosine distance (= 1 - cosine_similarity).
// Lower distance = more similar. Convert sim → dist via (1 - sim).
const SAME_SUBJECT_MAX_DIST = 0.22;    // similarity ≥ 0.78
const NEAR_DUPLICATE_MAX_DIST = 0.08;  // similarity ≥ 0.92

export interface ConflictResult {
  /** IDs of older memories the new one supersedes. Apply by setting `superseded=true` on each. */
  supersededIds: number[];
  /** True if the new memory is itself a near-duplicate of something existing → caller may skip storing it. */
  isNearDuplicate: boolean;
}

/**
 * Detect which existing memories the new fact supersedes.
 *
 * @param newContent     The plaintext of the new memory
 * @param newCategory    Tag/category of the new memory (e.g., "location", "health")
 * @param newShard       Shard the new memory belongs to
 * @param existing       All currently-active (non-superseded) memories in the same shard
 * @param index          The vector index containing the existing memories
 * @returns              Set of memory ids whose `superseded` flag should be flipped to true
 */
export async function detectConflicts(
  newContent: string,
  newCategory: string,
  newShard: string,
  existing: MemoryRecord[],
  index: VectorIndex
): Promise<ConflictResult> {
  if (existing.length === 0) {
    return { supersededIds: [], isNearDuplicate: false };
  }

  // 1. Embed the new fact and find semantically-similar existing ones.
  const newVec = await embed(newContent);
  const candidates = index.search(newVec, Math.min(20, existing.length));

  const supersededIds: number[] = [];
  let isNearDuplicate = false;

  for (const cand of candidates) {
    const rec = existing.find((r) => r.id === cand.id);
    if (!rec) continue;
    if (rec.shard !== newShard) continue;

    const dist = cand.distance;

    if (dist <= NEAR_DUPLICATE_MAX_DIST) {
      // Near-identical content already stored → don't store again
      isNearDuplicate = true;
      continue;
    }

    if (dist <= SAME_SUBJECT_MAX_DIST) {
      // Same subject, different wording → likely an update. Supersede the old one.
      // Require category overlap for high precision (avoid false positives).
      const catMatch = rec.tags.some((t) => t.toLowerCase() === newCategory.toLowerCase());
      if (catMatch) {
        supersededIds.push(rec.id);
      }
    }
  }

  return { supersededIds, isNearDuplicate };
}
