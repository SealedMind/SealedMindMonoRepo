/**
 * Local embedding service using @xenova/transformers.
 *
 * Uses all-MiniLM-L6-v2 (384-dim) for fast, lightweight embeddings.
 * In production with 0G H100 TEE embedding support, this would run
 * e5-large-v2 (1024-dim) inside the enclave. The interface is identical.
 */

let pipelinePromise: Promise<any> | null = null;

function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    })();
  }
  return pipelinePromise;
}

/**
 * Generate a normalized embedding vector for the given text.
 * Returns a Float32Array of dimension 384.
 */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data);
}

/**
 * Batch embed multiple texts. Returns array of Float32Array.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const t of texts) {
    results.push(await embed(t));
  }
  return results;
}

/** Embedding dimension for the current model. */
export const EMBEDDING_DIM = 384;
