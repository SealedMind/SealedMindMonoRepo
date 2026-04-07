import { describe, it, expect } from "vitest";

// Test the pad/unpad helpers via module-level imports
// Since they're not exported, we test them indirectly via putRaw/getRaw round-trip
// For now, replicate the logic to unit-test directly.

const CHUNK_SIZE = 256;
const HEADER_BYTES = 4;

function padToChunk(bytes: Uint8Array): Uint8Array {
  const total = HEADER_BYTES + bytes.length;
  const padded = Math.ceil(total / CHUNK_SIZE) * CHUNK_SIZE;
  const out = new Uint8Array(padded);
  out[0] = (bytes.length >>> 24) & 0xff;
  out[1] = (bytes.length >>> 16) & 0xff;
  out[2] = (bytes.length >>> 8) & 0xff;
  out[3] = bytes.length & 0xff;
  out.set(bytes, HEADER_BYTES);
  return out;
}

function unpadFromChunk(padded: Uint8Array): Uint8Array {
  if (padded.length < HEADER_BYTES) throw new Error("Blob too short to unpad");
  const len = (padded[0] << 24) | (padded[1] << 16) | (padded[2] << 8) | padded[3];
  if (len < 0 || len > padded.length - HEADER_BYTES) {
    throw new Error(`Invalid length header: ${len}`);
  }
  return padded.slice(HEADER_BYTES, HEADER_BYTES + len);
}

describe("chunk padding", () => {
  it("pads small data to 256 bytes", () => {
    const data = new Uint8Array([1, 2, 3]);
    const padded = padToChunk(data);
    expect(padded.length).toBe(256);
    expect(padded.length % CHUNK_SIZE).toBe(0);
  });

  it("round-trips data exactly", () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const padded = padToChunk(data);
    const restored = unpadFromChunk(padded);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it("round-trips data that fills exactly one chunk", () => {
    const data = new Uint8Array(252); // 252 + 4 header = 256
    data.fill(0xab);
    const padded = padToChunk(data);
    expect(padded.length).toBe(256);
    const restored = unpadFromChunk(padded);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it("round-trips data crossing chunk boundary", () => {
    const data = new Uint8Array(253); // 253 + 4 = 257 → pad to 512
    data.fill(0xcd);
    const padded = padToChunk(data);
    expect(padded.length).toBe(512);
    const restored = unpadFromChunk(padded);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it("round-trips larger data", () => {
    const data = new Uint8Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = i % 256;
    const padded = padToChunk(data);
    expect(padded.length % CHUNK_SIZE).toBe(0);
    expect(padded.length).toBe(1024); // ceil((1000+4)/256)*256 = 1024
    const restored = unpadFromChunk(padded);
    expect(Array.from(restored)).toEqual(Array.from(data));
  });

  it("rejects too-short blob on unpad", () => {
    expect(() => unpadFromChunk(new Uint8Array(2))).toThrow("Blob too short");
  });
});
