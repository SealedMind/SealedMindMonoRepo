import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

/**
 * Wraps 0G Sealed Inference (TEE) for fact extraction.
 *
 * The chat model (Qwen 2.5 7B) runs inside the TEE. We use it to extract
 * structured facts from raw conversation text. Every call is TEE-attested.
 */

export interface ExtractedFact {
  fact: string;
  category: string;
  confidence: number;
}

export interface InferenceResult {
  facts: ExtractedFact[];
  chatId: string;
  attestationValid: boolean;
}

export interface InferenceConfig {
  rpcUrl: string;
  privateKey: string;
}

export class InferenceService {
  private broker: any;
  private providerAddr: string | null = null;
  private wallet: ethers.Wallet;
  private rpcUrl: string;

  constructor(private cfg: InferenceConfig) {
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const pk = cfg.privateKey.startsWith("0x") ? cfg.privateKey : `0x${cfg.privateKey}`;
    this.wallet = new ethers.Wallet(pk, provider);
    this.rpcUrl = cfg.rpcUrl;
  }

  async init(): Promise<void> {
    this.broker = await createZGComputeNetworkBroker(this.wallet as any);
    const services = await this.broker.inference.listService();
    const chatbot = services.find((s: any) => s.serviceType === "chatbot");
    if (!chatbot) throw new Error("No chatbot service found on 0G Compute");
    this.providerAddr = chatbot.provider;
  }

  /**
   * Extract structured facts from raw text using the TEE-hosted LLM.
   * Returns parsed facts + attestation info.
   */
  async extractFacts(content: string): Promise<InferenceResult> {
    if (!this.broker || !this.providerAddr) throw new Error("Call init() first");

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(this.providerAddr);
    const headers = await this.broker.inference.getRequestHeaders(this.providerAddr);

    const messages = [
      {
        role: "system",
        content: `You are a fact extraction engine. Given user text, extract discrete facts.
Return ONLY a JSON array of objects with: {"fact": "...", "category": "...", "confidence": 0.0-1.0}
Categories: personal, health, work, finance, preferences, relationships, location, general.
Be precise. No commentary outside the JSON array.`,
      },
      { role: "user", content },
    ];

    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ messages, model, max_tokens: 500, temperature: 0.1 }),
    });

    if (!resp.ok) {
      throw new Error(`Inference failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    const chatId = resp.headers.get("ZG-Res-Key") || data.id || "";

    // Verify TEE attestation
    let attestationValid = false;
    if (chatId) {
      try {
        attestationValid = await this.broker.inference.processResponse(this.providerAddr, chatId);
      } catch {
        // Attestation check can fail transiently; log but don't block
        attestationValid = false;
      }
    }

    // Parse facts from LLM response
    let facts: ExtractedFact[];
    try {
      const parsed = JSON.parse(raw);
      facts = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If LLM returns non-JSON, wrap it as a single fact
      facts = [{ fact: raw, category: "general", confidence: 0.5 }];
    }

    return { facts, chatId, attestationValid };
  }

  /**
   * Chat completion for recall synthesis — given retrieved memories and a query,
   * produce a natural-language answer. Also runs inside TEE.
   */
  async synthesize(query: string, memories: string[]): Promise<{ answer: string; chatId: string; attestationValid: boolean }> {
    if (!this.broker || !this.providerAddr) throw new Error("Call init() first");

    const { endpoint, model } = await this.broker.inference.getServiceMetadata(this.providerAddr);
    const headers = await this.broker.inference.getRequestHeaders(this.providerAddr);

    const memoryContext = memories.map((m, i) => `[${i + 1}] ${m}`).join("\n");
    const messages = [
      {
        role: "system",
        content: `You are an AI assistant with access to the user's sealed memories. Answer the query using ONLY the provided memories. Be concise and factual. If the memories don't contain relevant information, say so.

MEMORIES:
${memoryContext}`,
      },
      { role: "user", content: query },
    ];

    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ messages, model, max_tokens: 300, temperature: 0.2 }),
    });

    if (!resp.ok) throw new Error(`Synthesis failed: ${resp.status}`);

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content ?? "";
    const chatId = resp.headers.get("ZG-Res-Key") || data.id || "";

    let attestationValid = false;
    if (chatId) {
      try {
        attestationValid = await this.broker.inference.processResponse(this.providerAddr, chatId);
      } catch { attestationValid = false; }
    }

    return { answer, chatId, attestationValid };
  }
}
