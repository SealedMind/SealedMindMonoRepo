import { describe, it, expect } from "vitest";
import { VectorIndex } from "../src/services/vectorIndex.js";

describe("VectorIndex", () => {
  it("adds vectors and searches top-K", () => {
    const idx = new VectorIndex(3, 100);
    idx.add(0, [1, 0, 0]);
    idx.add(1, [0.9, 0.1, 0]);
    idx.add(2, [0, 1, 0]);
    idx.add(3, [0, 0, 1]);

    const results = idx.search([1, 0, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe(0); // exact match
    expect(results[1].id).toBe(1); // closest neighbor
  });

  it("returns empty for empty index", () => {
    const idx = new VectorIndex(3, 100);
    expect(idx.search([1, 0, 0], 5)).toEqual([]);
  });

  it("reports correct size", () => {
    const idx = new VectorIndex(3, 100);
    expect(idx.size).toBe(0);
    idx.add(0, [1, 0, 0]);
    expect(idx.size).toBe(1);
    idx.add(1, [0, 1, 0]);
    expect(idx.size).toBe(2);
  });

  it("rejects wrong dimension", () => {
    const idx = new VectorIndex(3, 100);
    expect(() => idx.add(0, [1, 0])).toThrow();
  });

  it("serializes and deserializes", () => {
    const idx = new VectorIndex(3, 100);
    idx.add(0, [1, 0, 0]);
    idx.add(1, [0, 1, 0]);

    const buf = idx.serialize();
    expect(buf.length).toBeGreaterThan(0);

    const loaded = VectorIndex.deserialize(buf, 3, 100);
    expect(loaded.size).toBe(2);
    const results = loaded.search([1, 0, 0], 1);
    expect(results[0].id).toBe(0);
  });
});
