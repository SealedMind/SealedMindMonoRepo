import { describe, it, expect } from "vitest";
import { extractFastPath, shouldRunLLM } from "../src/services/memoryExtractor";

describe("extractFastPath", () => {
  it("returns null on empty / whitespace-only text", () => {
    expect(extractFastPath("")).toBeNull();
    expect(extractFastPath("   \n  ")).toBeNull();
  });

  it("returns null when no markers present", () => {
    expect(extractFastPath("just a plain conversation about nothing")).toBeNull();
  });

  it("extracts an untyped [MEMORY: ...] marker", () => {
    const r = extractFastPath("Just chatting. [MEMORY: I prefer vegetarian meals]");
    expect(r).toEqual([{ fact: "I prefer vegetarian meals", category: "general", confidence: 0.9 }]);
  });

  it("extracts a typed [MEMORY:health: ...] marker", () => {
    const r = extractFastPath("[MEMORY:health: my blood type is O+]");
    expect(r).toEqual([{ fact: "my blood type is O+", category: "health", confidence: 0.95 }]);
  });

  it("extracts <fact category=\"...\"> ... </fact> XML tags", () => {
    const r = extractFastPath('Some text <fact category="finance">I bank at Mercury</fact>');
    expect(r).toEqual([{ fact: "I bank at Mercury", category: "finance", confidence: 0.95 }]);
  });

  it("extracts *remember:* markdown markers", () => {
    const r = extractFastPath("*remember:* I ran 8km this morning");
    expect(r).toEqual([{ fact: "I ran 8km this morning", category: "general", confidence: 0.85 }]);
  });

  it("extracts FACT[fitness]: enum markers", () => {
    const r = extractFastPath("FACT[fitness]: ran 8km in 45min");
    expect(r).toEqual([{ fact: "ran 8km in 45min", category: "fitness", confidence: 0.9 }]);
  });

  it("extracts multiple markers in one utterance", () => {
    const r = extractFastPath("[MEMORY:health: vegan] [MEMORY:work: data scientist at Acme]");
    expect(r).toHaveLength(2);
    expect(r![0].category).toBe("health");
    expect(r![1].category).toBe("work");
  });

  it("normalizes unknown categories to 'general'", () => {
    const r = extractFastPath("[MEMORY:unicorn-stuff: rainbow]");
    expect(r![0].category).toBe("general");
  });

  it("de-duplicates exact-text duplicates within the same call", () => {
    const r = extractFastPath("[MEMORY: I love coffee] [MEMORY: I love coffee]");
    expect(r).toHaveLength(1);
  });
});

describe("shouldRunLLM", () => {
  it("rejects very short utterances", () => {
    expect(shouldRunLLM("hi")).toBe(false);
    expect(shouldRunLLM("ok")).toBe(false);
  });

  it("rejects acknowledgements", () => {
    expect(shouldRunLLM("thanks")).toBe(false);
    expect(shouldRunLLM("Thank you!")).toBe(false);
    expect(shouldRunLLM("got it.")).toBe(false);
  });

  it("accepts substantive utterances", () => {
    expect(shouldRunLLM("I just finished an 8km run in 45 minutes")).toBe(true);
    expect(shouldRunLLM("My mother's birthday is on October 12")).toBe(true);
  });
});
