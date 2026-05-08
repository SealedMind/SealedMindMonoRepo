import fs from "node:fs";
import path from "node:path";
import { InferenceService, type ExtractedFact, type InferenceConfig } from "./inference.js";
import { embed, EMBEDDING_DIM } from "./embeddings.js";
import { VectorIndex, type SearchResult } from "./vectorIndex.js";
import { StorageService, type StorageConfig, type UploadResult } from "./storage.js";
import { encrypt, decrypt, generateKey } from "./crypto.js";
import { extractFastPath, shouldRunLLM } from "./memoryExtractor.js";
import { detectConflicts } from "./conflictResolver.js";

/**
 * SealedMind Memory Engine — orchestrates the full remember/recall flow.
 *
 * Remember:  text → fact extraction (TEE) → embed → index → encrypt → 0G Storage
 * Recall:    query → embed → search index → fetch + decrypt → synthesize (TEE)
 */

export interface MemoryRecord {
  id: number;
  content: string;
  type: "episodic" | "semantic" | "core";
  shard: string;
  tags: string[];
  createdAt: number;       // unix ms
  storageCID: string;      // 0G Storage rootHash
  /** Set true when a newer memory supersedes this one (recall filters it out). */
  superseded?: boolean;
  /** Timestamp the supersession happened (for audit/rollback). */
  supersededAt?: number;
  /** ID of the newer memory that replaced this one. */
  supersededBy?: number;
}

export interface RememberResult {
  memories: MemoryRecord[];
  attestation: {
    chatId: string;
    attestationValid: boolean;
  };
  storageCIDs: string[];
  txHashes: string[];
  /** Diagnostics: how the facts were extracted + supersession bookkeeping. */
  extraction: {
    path: "fast" | "llm" | "skipped";
    extractedCount: number;
    storedCount: number;
    skippedAsDuplicate: number;
    supersededIds: number[];
  };
}

export interface RecallResult {
  memories: MemoryRecord[];
  answer: string;
  attestation: {
    chatId: string;
    attestationValid: boolean;
  };
}

export interface MemoryEngineConfig {
  inference: InferenceConfig;
  storage: StorageConfig;
  dataDir?: string;        // directory for persisted index + records
  encryptionKey?: Buffer;  // if provided, used directly (never written to disk)
}

export class MemoryEngine {
  private inference: InferenceService;
  private storage: StorageService;
  private index: VectorIndex;
  private records: Map<number, MemoryRecord> = new Map();
  private encryptionKey: Buffer;
  private nextId: number = 0;
  private dataDir: string;

  // Paths for persisted index + records (key is never written to disk)
  private get recordsPath() { return path.join(this.dataDir, "sealedmind-records.json"); }
  private get indexPath()   { return path.join(this.dataDir, "sealedmind-index.bin"); }

  constructor(cfg: MemoryEngineConfig) {
    this.inference = new InferenceService(cfg.inference);
    this.storage = new StorageService(cfg.storage);
    this.dataDir = cfg.dataDir ?? path.resolve("data");
    fs.mkdirSync(this.dataDir, { recursive: true });

    // Use provided key (EngineRegistry path) or generate ephemeral key (test/standalone path)
    this.encryptionKey = cfg.encryptionKey ?? generateKey();

    this.index = new VectorIndex(EMBEDDING_DIM);
  }

  /** Initialize the inference broker and restore persisted state. */
  async init(): Promise<void> {
    await this.inference.init();
    this.loadState();
  }

  /** Reload records + HNSW index from disk. */
  private loadState(): void {
    if (fs.existsSync(this.recordsPath)) {
      const { nextId, records } = JSON.parse(fs.readFileSync(this.recordsPath, "utf8"));
      this.nextId = nextId;
      for (const r of records as MemoryRecord[]) {
        this.records.set(r.id, r);
      }
      console.log(`Restored ${this.records.size} memories from disk.`);
    }

    if (fs.existsSync(this.indexPath)) {
      const buf = fs.readFileSync(this.indexPath);
      this.index = VectorIndex.deserialize(buf, EMBEDDING_DIM);
      console.log(`Restored HNSW index (${this.index.size} vectors) from disk.`);
    }
  }

  /** Flush records + HNSW index to disk after each write. */
  private saveState(): void {
    fs.writeFileSync(
      this.recordsPath,
      JSON.stringify({ nextId: this.nextId, records: Array.from(this.records.values()) }),
      "utf8"
    );
    fs.writeFileSync(this.indexPath, this.index.serialize());
  }

  /**
   * Remember: process raw text into structured, encrypted memories.
   *
   * Two-pass extraction:
   *   Pass 1 (cheap): regex scan for explicit `[MEMORY: ...]` markers.
   *   Pass 2 (TEE LLM): only if Pass 1 finds nothing AND the text looks
   *                     substantial enough to warrant the cost.
   *
   * After extraction, each fact runs through the conflict resolver:
   *   - Near-duplicates of existing memories are dropped (no store, no upload)
   *   - Updates to existing facts (same subject, same category, different
   *     wording) mark the old memory as superseded so future recalls skip it.
   *
   * Flow per stored fact: embed → conflict-check → encrypt → 0G Storage → index
   */
  async remember(
    content: string,
    shard: string = "general",
    type: "episodic" | "semantic" | "core" = "semantic"
  ): Promise<RememberResult> {
    let facts: ExtractedFact[];
    let chatId = "";
    let attestationValid = false;
    let path: "fast" | "llm" | "skipped" = "skipped";

    // ── Pass 1 — fast-path regex scan ───────────────────────────────────
    const fastFacts = extractFastPath(content);
    if (fastFacts && fastFacts.length > 0) {
      facts = fastFacts;
      path = "fast";
    } else if (shouldRunLLM(content)) {
      // ── Pass 2 — fall back to TEE LLM extraction ─────────────────────
      const r = await this.inference.extractFacts(content);
      facts = r.facts;
      chatId = r.chatId;
      attestationValid = r.attestationValid;
      path = "llm";
    } else {
      // Nothing to extract (greeting, ack, too short).
      return {
        memories: [],
        attestation: { chatId: "", attestationValid: false },
        storageCIDs: [],
        txHashes: [],
        extraction: { path: "skipped", extractedCount: 0, storedCount: 0, skippedAsDuplicate: 0, supersededIds: [] },
      };
    }

    const memories: MemoryRecord[] = [];
    const storageCIDs: string[] = [];
    const txHashes: string[] = [];
    let skippedAsDuplicate = 0;
    const supersededAcc: number[] = [];

    // Snapshot of currently-active memories in this shard (for conflict check)
    const activeInShard = Array.from(this.records.values()).filter(
      (r) => r.shard === shard && !r.superseded
    );

    for (const fact of facts) {
      // ── Conflict resolution before we spend storage budget ─────────────
      const conflict = await detectConflicts(fact.fact, fact.category, shard, activeInShard, this.index);
      if (conflict.isNearDuplicate) {
        skippedAsDuplicate++;
        continue;
      }

      // Encrypt + store the new memory
      const vector = await embed(fact.fact);
      const id = this.nextId++;
      const record: MemoryRecord = {
        id,
        content: fact.fact,
        type,
        shard,
        tags: [fact.category],
        createdAt: Date.now(),
        storageCID: "",
      };
      const { rootHash, txHash } = await this.storage.putEncrypted(JSON.stringify(record), this.encryptionKey);
      record.storageCID = rootHash;

      this.index.add(id, vector);
      this.records.set(id, record);
      memories.push(record);
      storageCIDs.push(rootHash);
      txHashes.push(txHash);

      // Mark old memories as superseded (non-destructive — they stay on chain)
      for (const oldId of conflict.supersededIds) {
        const old = this.records.get(oldId);
        if (old && !old.superseded) {
          old.superseded = true;
          old.supersededAt = Date.now();
          old.supersededBy = id;
          supersededAcc.push(oldId);
        }
      }
    }

    this.saveState();

    return {
      memories,
      attestation: { chatId, attestationValid },
      storageCIDs,
      txHashes,
      extraction: {
        path,
        extractedCount: facts.length,
        storedCount: memories.length,
        skippedAsDuplicate,
        supersededIds: supersededAcc,
      },
    };
  }

  /**
   * Recall: query memories and synthesize an answer.
   *
   * Flow: query → embed → search index → fetch + decrypt → synthesize (TEE)
   */
  async recall(
    query: string,
    topK: number = 5,
    shard?: string
  ): Promise<RecallResult> {
    // 1. Embed the query
    const queryVec = await embed(query);

    // 2. Search the vector index
    let results: SearchResult[] = this.index.search(queryVec, topK * 2);

    // 3. Filter by shard + skip superseded entries
    let matchedRecords: MemoryRecord[] = results
      .map((r) => this.records.get(r.id))
      .filter((r): r is MemoryRecord => r !== undefined)
      .filter((r) => !r.superseded)
      .filter((r) => !shard || r.shard === shard)
      .slice(0, topK);

    // 4. Synthesize answer inside TEE
    const memoryTexts = matchedRecords.map((m) => m.content);
    const { answer, chatId, attestationValid } = memoryTexts.length > 0
      ? await this.inference.synthesize(query, memoryTexts)
      : { answer: "No relevant memories found.", chatId: "", attestationValid: false };

    return {
      memories: matchedRecords,
      answer,
      attestation: { chatId, attestationValid },
    };
  }

  /** Get all memory records (for dashboard display). */
  getAllRecords(): MemoryRecord[] {
    return Array.from(this.records.values());
  }

  /** Get memory count. */
  get memoryCount(): number {
    return this.records.size;
  }

  /** Get the encryption key (in production, this never leaves the TEE). */
  getEncryptionKey(): Buffer {
    return this.encryptionKey;
  }
}
