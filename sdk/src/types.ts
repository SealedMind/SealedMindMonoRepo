/** Public SDK types for SealedMind. */

export interface Mind {
  id: string;
  owner: string;
  name: string;
  memoryCount: number;
  shards: string[];
  createdAt: string;
}

export interface Memory {
  id: string;
  content: string;
  type: "episodic" | "semantic" | "core";
  shard: string;
  tags: string[];
  storageCID: string;
  createdAt: string;
}

export interface RememberOptions {
  content: string;
  shard?: string;
  type?: "episodic" | "semantic" | "core";
  tags?: string[];
}

export interface RememberResult {
  success: boolean;
  memories: Memory[];
  attestation: Attestation;
  mindStats: { totalMemories: number };
}

export interface RecallOptions {
  query: string;
  shard?: string;
  topK?: number;
  includeAttestation?: boolean;
}

export interface RecallResult {
  memories: Memory[];
  answer: string;
  attestation?: Attestation;
}

export interface Attestation {
  chatId: string;
  verified: boolean;
  enclave: string;
}

export interface CapabilityGrant {
  capId: string;
  mindId: string;
  shardName: string;
  grantee: string;
  readOnly: boolean;
  expiry: number;
  revoked: boolean;
  grantedAt: string;
}

export interface SealedMindConfig {
  apiUrl: string;
  signer?: import("ethers").Signer;
}

export interface AuthSession {
  token: string;
  address: string;
}
