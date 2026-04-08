import { SiweMessage } from "siwe";
import type { Signer } from "ethers";
import type {
  SealedMindConfig,
  AuthSession,
  Mind,
  RememberOptions,
  RememberResult,
  RecallOptions,
  RecallResult,
  CapabilityGrant,
  Attestation,
} from "./types.js";

/**
 * SealedMind SDK client.
 *
 * Usage:
 * ```ts
 * const mind = new SealedMind({ apiUrl: "http://localhost:4000", signer });
 * await mind.login();
 * const result = await mind.remember("mind-1", { content: "I live in Tokyo" });
 * const recalled = await mind.recall("mind-1", { query: "Where do I live?" });
 * ```
 */
export class SealedMind {
  private apiUrl: string;
  private signer?: Signer;
  private session: AuthSession | null = null;

  constructor(config: SealedMindConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
    this.signer = config.signer;
  }

  /** Whether the client has an active session. */
  get isAuthenticated(): boolean {
    return this.session !== null;
  }

  /** The authenticated wallet address, or null. */
  get address(): string | null {
    return this.session?.address ?? null;
  }

  /** Set a pre-existing session token (e.g. from localStorage). */
  setSession(session: AuthSession): void {
    this.session = session;
  }

  // ── Auth ──────────────────────────────────────────────

  /** Authenticate via SIWE. Requires a signer to be configured. */
  async login(domain?: string, uri?: string): Promise<AuthSession> {
    if (!this.signer) throw new Error("Signer required for login");

    const address = await this.signer.getAddress();

    // Get nonce from server
    const { nonce } = await this.get<{ nonce: string }>("/v1/auth/nonce");

    // Build SIWE message
    const message = new SiweMessage({
      domain: domain || "sealedmind.xyz",
      address,
      statement: "Sign in to SealedMind",
      uri: uri || this.apiUrl,
      version: "1",
      chainId: 16602,
      nonce,
    });

    const messageStr = message.prepareMessage();
    const signature = await this.signer.signMessage(messageStr);

    const result = await this.post<AuthSession>("/v1/auth/login", {
      message: messageStr,
      signature,
    });

    this.session = result;
    return result;
  }

  /** Log out (clear local session). */
  logout(): void {
    this.session = null;
  }

  // ── Minds ─────────────────────────────────────────────

  /** Create a new Mind. */
  async createMind(name: string, shards?: string[]): Promise<{ mind: Mind }> {
    return this.post("/v1/minds", { name, shards });
  }

  /** List user's Minds. */
  async listMinds(): Promise<{ minds: Mind[] }> {
    return this.get("/v1/minds");
  }

  /** Get Mind details. */
  async getMind(mindId: string): Promise<{ mind: Mind & { records: any[] } }> {
    return this.get(`/v1/minds/${mindId}`);
  }

  /** Get Mind memory statistics. */
  async getMindStats(mindId: string): Promise<{
    totalMemories: number;
    shardMemories: Record<string, number>;
  }> {
    return this.get(`/v1/minds/${mindId}/stats`);
  }

  /** Create a shard on a Mind. */
  async createShard(
    mindId: string,
    name: string
  ): Promise<{ success: boolean; shard: string }> {
    return this.post(`/v1/minds/${mindId}/shards`, { name });
  }

  // ── Memory ────────────────────────────────────────────

  /** Store a memory (routed through TEE). */
  async remember(mindId: string, opts: RememberOptions): Promise<RememberResult> {
    return this.post(`/v1/minds/${mindId}/remember`, opts);
  }

  /** Recall memories (routed through TEE). */
  async recall(mindId: string, opts: RecallOptions): Promise<RecallResult> {
    return this.post(`/v1/minds/${mindId}/recall`, opts);
  }

  // ── Capabilities ──────────────────────────────────────

  /** Grant a capability on a shard. */
  async grantCapability(
    mindId: string,
    shardName: string,
    grantee: string,
    opts?: { readOnly?: boolean; expiry?: number }
  ): Promise<{ success: boolean; capability: CapabilityGrant }> {
    return this.post(`/v1/minds/${mindId}/capabilities`, {
      shardName,
      grantee,
      readOnly: opts?.readOnly ?? true,
      expiry: opts?.expiry,
    });
  }

  /** List capabilities for a Mind. */
  async listCapabilities(
    mindId: string
  ): Promise<{ capabilities: CapabilityGrant[] }> {
    return this.get(`/v1/minds/${mindId}/capabilities`);
  }

  /** Revoke a capability. */
  async revokeCapability(
    mindId: string,
    capId: string
  ): Promise<{ success: boolean; capId: string }> {
    return this.delete(`/v1/minds/${mindId}/capabilities/${capId}`);
  }

  // ── Attestations ──────────────────────────────────────

  /** Get attestation details by hash. */
  async getAttestation(
    hash: string
  ): Promise<{ attestation: Attestation & { hash: string; operation: string; mindId: string; timestamp: string } }> {
    return this.get(`/v1/attestations/${hash}`);
  }

  /** Verify an attestation. */
  async verifyAttestation(
    hash: string
  ): Promise<{ verified: boolean; attestation?: any; reason?: string }> {
    return this.post("/v1/attestations/verify", { hash });
  }

  // ── HTTP helpers ──────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.session) {
      h["Authorization"] = `Bearer ${this.session.token}`;
    }
    return h;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new SealedMindError(res.status, (body as any).error || res.statusText, path);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      throw new SealedMindError(res.status, (respBody as any).error || res.statusText, path);
    }
    return res.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new SealedMindError(res.status, (body as any).error || res.statusText, path);
    }
    return res.json() as Promise<T>;
  }
}

/** Error class for SealedMind API errors. */
export class SealedMindError extends Error {
  constructor(
    public status: number,
    message: string,
    public path: string
  ) {
    super(`SealedMind API error (${status}) on ${path}: ${message}`);
    this.name = "SealedMindError";
  }
}
