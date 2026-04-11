import fs from "node:fs";
import hnswlib from "hnswlib-node";

/**
 * HNSW vector index for memory similarity search.
 *
 * Wraps hnswlib-node. The serialized index is encrypted and stored on
 * 0G Storage. In the TEE path, the index is loaded/decrypted inside
 * the enclave, searched, and re-encrypted on write.
 */

export interface SearchResult {
  id: number;
  distance: number;
}

export class VectorIndex {
  private index: hnswlib.HierarchicalNSW;
  private dim: number;
  private count: number = 0;

  constructor(dim: number, maxElements: number = 10_000) {
    this.dim = dim;
    this.index = new hnswlib.HierarchicalNSW("cosine", dim);
    this.index.initIndex(maxElements);
  }

  /** Add a vector with an integer label. */
  add(label: number, vector: Float32Array | number[]): void {
    const arr = vector instanceof Float32Array ? Array.from(vector) : vector;
    if (arr.length !== this.dim) throw new Error(`Vector dim ${arr.length} != ${this.dim}`);
    this.index.addPoint(arr, label);
    this.count++;
  }

  /** Search for the top-K nearest neighbors to query. */
  search(query: Float32Array | number[], topK: number = 5): SearchResult[] {
    if (this.count === 0) return [];
    const k = Math.min(topK, this.count);
    const arr = query instanceof Float32Array ? Array.from(query) : query;
    const result = this.index.searchKnn(arr, k);
    const results: SearchResult[] = [];
    for (let i = 0; i < result.neighbors.length; i++) {
      results.push({
        id: result.neighbors[i],
        distance: result.distances[i],
      });
    }
    return results.sort((a, b) => a.distance - b.distance);
  }

  /** Serialize the index to a Buffer for encrypted storage. */
  serialize(): Buffer {
    const tmpPath = `/tmp/sealedmind-hnsw-${Date.now()}.bin`;
    this.index.writeIndexSync(tmpPath);
    const buf = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);
    return buf;
  }

  /** Deserialize an index from a Buffer. */
  static deserialize(data: Buffer, dim: number, maxElements: number = 10_000): VectorIndex {
    const vi = new VectorIndex(dim, maxElements);
    const tmpPath = `/tmp/sealedmind-hnsw-load-${Date.now()}.bin`;
    fs.writeFileSync(tmpPath, data);
    vi.index.readIndexSync(tmpPath);
    vi.count = vi.index.getCurrentCount();
    fs.unlinkSync(tmpPath);
    return vi;
  }

  get size(): number {
    return this.count;
  }
}
