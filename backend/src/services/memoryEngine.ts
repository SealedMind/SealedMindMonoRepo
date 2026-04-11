import fs from "node:fs";
import path from "node:path";
import { InferenceService, type ExtractedFact, type InferenceConfig } from "./inference.js";
import { embed, EMBEDDING_DIM } from "./embeddings.js";
import { VectorIndex, type SearchResult } from "./vectorIndex.js";
import { StorageService, type StorageConfig, type UploadResult } from "./storage.js";
import { encrypt, decrypt, generateKey } from "./crypto.js";

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
}

export interface RememberResult {
  memories: MemoryRecord[];
  attestation: {
    chatId: string;
    attestationValid: boolean;
  };
  storageCIDs: string[];
  txHashes: string[];
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
  dataDir?: string; // directory for persisted state (key, index, records)
}

export class MemoryEngine {
  private inference: InferenceService;
  private storage: StorageService;
  private index: VectorIndex;
  private records: Map<number, MemoryRecord> = new Map();
  private encryptionKey: Buffer;
  private nextId: number = 0;
  private dataDir: string;

  // Paths for persisted state
  private get keyPath()     { return path.join(this.dataDir, "sealedmind.key"); }
  private get recordsPath() { return path.join(this.dataDir, "sealedmind-records.json"); }
  private get indexPath()   { return path.join(this.dataDir, "sealedmind-index.bin"); }

  constructor(cfg: MemoryEngineConfig) {
    this.inference = new InferenceService(cfg.inference);
    this.storage = new StorageService(cfg.storage);
    this.dataDir = cfg.dataDir ?? path.resolve("data");
    fs.mkdirSync(this.dataDir, { recursive: true });

    // Load or generate encryption key
    if (fs.existsSync(this.keyPath)) {
      this.encryptionKey = Buffer.from(fs.readFileSync(this.keyPath, "utf8"), "hex");
    } else {
      this.encryptionKey = generateKey();
      fs.writeFileSync(this.keyPath, this.encryptionKey.toString("hex"), "utf8");
    }

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
   * Flow: text → fact extraction (TEE) → embed → index → encrypt → 0G Storage
   */
  async remember(
    content: string,
    shard: string = "general",
    type: "episodic" | "semantic" | "core" = "semantic"
  ): Promise<RememberResult> {
    // 1. Extract facts inside TEE
    const { facts, chatId, attestationValid } = await this.inference.extractFacts(content);

    const memories: MemoryRecord[] = [];
    const storageCIDs: string[] = [];
    const txHashes: string[] = [];

    for (const fact of facts) {
      // 2. Generate embedding (local — TEE-ready when 0G adds embedding models)
      const vector = await embed(fact.fact);

      // 3. Build memory record
      const id = this.nextId++;
      const record: MemoryRecord = {
        id,
        content: fact.fact,
        type,
        shard,
        tags: [fact.category],
        createdAt: Date.now(),
        storageCID: "", // filled after upload
      };

      // 4. Encrypt and upload to 0G Storage
      const payload = JSON.stringify(record);
      const { rootHash, txHash } = await this.storage.putEncrypted(payload, this.encryptionKey);
      record.storageCID = rootHash;

      // 5. Add to vector index
      this.index.add(id, vector);
      this.records.set(id, record);
      memories.push(record);
      storageCIDs.push(rootHash);
      txHashes.push(txHash);
    }

    this.saveState();

    return {
      memories,
      attestation: { chatId, attestationValid },
      storageCIDs,
      txHashes,
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

    // 3. Filter by shard if specified
    let matchedRecords: MemoryRecord[] = results
      .map((r) => this.records.get(r.id))
      .filter((r): r is MemoryRecord => r !== undefined)
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
