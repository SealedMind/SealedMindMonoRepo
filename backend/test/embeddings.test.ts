import { describe, it, expect } from "vitest";
import { embed, embedBatch, EMBEDDING_DIM } from "../src/services/embeddings.js";

describe("embeddings", () => {
  it("produces a 384-dim vector", async () => {
    const vec = await embed("hello world");
    expect(vec.length).toBe(EMBEDDING_DIM);
    expect(vec).toBeInstanceOf(Float32Array);
  }, 30_000);

  it("similar texts have high cosine similarity", async () => {
    const a = await embed("I am allergic to shellfish");
    const b = await embed("I have a shellfish allergy");
    const c = await embed("The stock market crashed today");

    const simAB = cosine(a, b);
    const simAC = cosine(a, c);
    expect(simAB).toBeGreaterThan(simAC);
    expect(simAB).toBeGreaterThan(0.7);
  }, 30_000);

  it("batch embed returns correct count", async () => {
    const vecs = await embedBatch(["one", "two", "three"]);
    expect(vecs.length).toBe(3);
    vecs.forEach(v => expect(v.length).toBe(EMBEDDING_DIM));
  }, 30_000);
});

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
