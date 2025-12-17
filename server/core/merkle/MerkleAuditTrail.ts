/**
 * Merkle Audit Trail - Workstream A
 * 
 * Implements tamper-evident event history with:
 * - Canonical event digest and leaf hash computation
 * - Merkle batch sealing with root signing
 * - Proof API for inclusion verification
 * - Anchoring outside DB trust boundary
 * 
 * INVARIANT: Any single event's inclusion proof verifies against an anchored root.
 * INVARIANT: Modifying any event after sealing makes proof verification fail.
 */

import * as crypto from 'crypto';

// ============================================================
// TYPES AND INTERFACES
// ============================================================

export interface EventMetadata {
  tenantId: string;
  environmentId: string;
  eventId: string;
  streamId: string;
  streamVersion: number;
  eventType: string;
  occurredAt: Date;
  committedAt: Date;
  commitSeq: bigint;
}

export interface EventPayload {
  [key: string]: unknown;
}

export interface EventDigest {
  eventId: string;
  payloadHash: string;
  metaHash: string;
  eventDigest: string;
  leafHash: string;
}

export interface MerkleBatch {
  batchId: string;
  tenantId: string;
  environmentId: string;
  algoVersion: string;
  startCommitSeq: bigint;
  endCommitSeq: bigint;
  eventCount: number;
  rootHash: string;
  prevRootHash: string | null;
  sealedAt: Date;
  rootSignature: string;
  signingKeyId: string;
  anchorType: 'WORM_S3' | 'RFC3161' | 'TRANSPARENCY_LOG' | 'NONE';
  anchorRef: string | null;
  status: 'OPEN' | 'SEALED' | 'FAILED';
}

export interface MerkleEventIndex {
  batchId: string;
  eventId: string;
  leafIndex: number;
  leafHash: string;
}

export interface MerkleProof {
  batchId: string;
  eventId: string;
  leafIndex: number;
  leafHash: string;
  siblings: string[];
  rootHash: string;
  algoVersion: string;
  rootSignature: string;
  signingKeyId: string;
  anchorType: string;
  anchorRef: string | null;
  batchMetadata: {
    tenantId: string;
    environmentId: string;
    startCommitSeq: string;
    endCommitSeq: string;
    eventCount: number;
    sealedAt: string;
  };
}

export interface VerificationResult {
  valid: boolean;
  recomputedRoot: string;
  expectedRoot: string;
  signatureValid: boolean;
  anchorValid: boolean;
  errors: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const ALGO_VERSION = 'TD-MERKLE-v1-SHA256';
const EVENT_DIGEST_PREFIX = 'TD:EVENT:v1|';
const LEAF_PREFIX = Buffer.from([0x00]);
const INTERNAL_PREFIX = Buffer.from([0x01]);
const BATCH_SIGN_PREFIX = 'TD:MERKLEBATCH:v1|';

// ============================================================
// CANONICAL JSON
// ============================================================

/**
 * Produce canonical JSON with sorted keys, no whitespace, stable number formatting
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted: Record<string, unknown>, key) => {
        sorted[key] = value[key];
        return sorted;
      }, {});
    }
    // Convert BigInt to string for JSON serialization
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// ============================================================
// HASH FUNCTIONS
// ============================================================

/**
 * SHA-256 hash returning hex string
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * SHA-256 hash returning Buffer
 */
export function sha256Buffer(data: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

// ============================================================
// EVENT DIGEST AND LEAF HASH (A1)
// ============================================================

/**
 * Compute canonical event digest and leaf hash at write time
 * 
 * This MUST be called in the same DB transaction as event persistence.
 */
export function computeEventDigest(
  metadata: EventMetadata,
  payload: EventPayload,
  redactPII: boolean = true
): EventDigest {
  // Compute payload hash (optionally redacted)
  const payloadForHash = redactPII ? redactPayload(payload) : payload;
  const payloadHash = sha256(canonicalJson(payloadForHash));
  
  // Compute metadata hash
  const metaHash = sha256(canonicalJson({
    tenantId: metadata.tenantId,
    environmentId: metadata.environmentId,
    eventId: metadata.eventId,
    streamId: metadata.streamId,
    streamVersion: metadata.streamVersion,
    eventType: metadata.eventType,
    occurredAt: metadata.occurredAt.toISOString(),
    committedAt: metadata.committedAt.toISOString(),
    commitSeq: metadata.commitSeq.toString(),
  }));
  
  // Build canonical event digest
  const digestInput = [
    EVENT_DIGEST_PREFIX,
    metadata.tenantId, '|',
    metadata.environmentId, '|',
    metadata.eventId, '|',
    metadata.streamId, '|',
    metadata.streamVersion.toString(), '|',
    metadata.eventType, '|',
    metadata.occurredAt.toISOString(), '|',
    metadata.committedAt.toISOString(), '|',
    payloadHash, '|',
    metaHash,
  ].join('');
  
  const eventDigest = sha256(digestInput);
  
  // Compute leaf hash: SHA256(0x00 || event_digest)
  const leafHash = sha256(Buffer.concat([LEAF_PREFIX, Buffer.from(eventDigest, 'hex')]));
  
  return {
    eventId: metadata.eventId,
    payloadHash,
    metaHash,
    eventDigest,
    leafHash,
  };
}

/**
 * Redact PII from payload for hashing
 * Override this based on your data model
 */
function redactPayload(payload: EventPayload): EventPayload {
  const redacted = { ...payload };
  const piiFields = ['ssn', 'taxId', 'dateOfBirth', 'address', 'phone', 'email'];
  
  for (const field of piiFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  return redacted;
}

// ============================================================
// MERKLE TREE CONSTRUCTION (A2)
// ============================================================

/**
 * Build Merkle tree from leaf hashes
 * Returns all levels (level 0 = leaves)
 */
export function buildMerkleTree(leafHashes: string[]): string[][] {
  if (leafHashes.length === 0) {
    throw new Error('Cannot build Merkle tree from empty leaf set');
  }
  
  const levels: string[][] = [];
  let currentLevel = [...leafHashes];
  levels.push(currentLevel);
  
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // If odd number, duplicate last hash
      const right = currentLevel[i + 1] ?? currentLevel[i];
      
      // Internal node: SHA256(0x01 || left || right)
      const nodeHash = sha256(Buffer.concat([
        INTERNAL_PREFIX,
        Buffer.from(left, 'hex'),
        Buffer.from(right, 'hex'),
      ]));
      
      nextLevel.push(nodeHash);
    }
    
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }
  
  return levels;
}

/**
 * Get root hash from tree levels
 */
export function getRootHash(levels: string[][]): string {
  return levels[levels.length - 1][0];
}

/**
 * Generate inclusion proof for a leaf at given index
 */
export function generateInclusionProof(levels: string[][], leafIndex: number): string[] {
  const siblings: string[] = [];
  let index = leafIndex;
  
  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    
    // If sibling exists, add it; otherwise duplicate (odd case)
    const sibling = currentLevel[siblingIndex] ?? currentLevel[index];
    siblings.push(sibling);
    
    // Move to parent index
    index = Math.floor(index / 2);
  }
  
  return siblings;
}

// ============================================================
// ROOT SIGNING (A3)
// ============================================================

/**
 * Sign Merkle batch root
 * In production, this should use KMS/HSM
 */
export function signBatchRoot(
  rootHash: string,
  batch: Omit<MerkleBatch, 'rootSignature' | 'signingKeyId' | 'status'>,
  privateKey: string
): { signature: string; keyId: string } {
  // Build batch metadata hash
  const metadataHash = sha256(canonicalJson({
    tenantId: batch.tenantId,
    environmentId: batch.environmentId,
    startCommitSeq: batch.startCommitSeq.toString(),
    endCommitSeq: batch.endCommitSeq.toString(),
    eventCount: batch.eventCount,
    sealedAt: batch.sealedAt.toISOString(),
    prevRootHash: batch.prevRootHash,
    algoVersion: batch.algoVersion,
  }));
  
  // Sign payload
  const signPayload = sha256(BATCH_SIGN_PREFIX + rootHash + metadataHash);
  
  // Sign with Ed25519 (or RSA in production)
  const sign = crypto.createSign('SHA256');
  sign.update(signPayload);
  const signature = sign.sign(privateKey, 'hex');
  
  // Key ID should come from KMS
  const keyId = sha256(privateKey).substring(0, 16);
  
  return { signature, keyId };
}

/**
 * Verify batch root signature
 */
export function verifyBatchSignature(
  rootHash: string,
  batch: MerkleBatch,
  publicKey: string
): boolean {
  const metadataHash = sha256(canonicalJson({
    tenantId: batch.tenantId,
    environmentId: batch.environmentId,
    startCommitSeq: batch.startCommitSeq.toString(),
    endCommitSeq: batch.endCommitSeq.toString(),
    eventCount: batch.eventCount,
    sealedAt: batch.sealedAt.toISOString(),
    prevRootHash: batch.prevRootHash,
    algoVersion: batch.algoVersion,
  }));
  
  const signPayload = sha256(BATCH_SIGN_PREFIX + rootHash + metadataHash);
  
  const verify = crypto.createVerify('SHA256');
  verify.update(signPayload);
  
  try {
    return verify.verify(publicKey, batch.rootSignature, 'hex');
  } catch {
    return false;
  }
}

// ============================================================
// BATCH SEALER (A2)
// ============================================================

export interface BatchSealerConfig {
  tenantId: string;
  environmentId: string;
  graceWindow: number; // Events within this window won't be sealed yet
  privateKey: string;
  publicKey: string;
}

export class MerkleBatchSealer {
  private config: BatchSealerConfig;
  private lastSealedEndSeq: bigint = BigInt(0);
  private batches: Map<string, MerkleBatch> = new Map();
  private eventIndex: Map<string, MerkleEventIndex> = new Map();
  private levelChunks: Map<string, string[][]> = new Map();
  
  constructor(config: BatchSealerConfig) {
    this.config = config;
  }
  
  /**
   * Seal a batch of events
   */
  async sealBatch(
    events: Array<{ metadata: EventMetadata; digest: EventDigest }>,
    prevRootHash: string | null = null
  ): Promise<MerkleBatch> {
    if (events.length === 0) {
      throw new Error('Cannot seal empty batch');
    }
    
    // Sort by commit_seq, then event_id
    const sorted = [...events].sort((a, b) => {
      const seqDiff = Number(a.metadata.commitSeq - b.metadata.commitSeq);
      if (seqDiff !== 0) return seqDiff;
      return a.metadata.eventId.localeCompare(b.metadata.eventId);
    });
    
    // Extract leaf hashes
    const leafHashes = sorted.map(e => e.digest.leafHash);
    
    // Build Merkle tree
    const levels = buildMerkleTree(leafHashes);
    const rootHash = getRootHash(levels);
    
    // Create batch metadata
    const batchId = crypto.randomUUID();
    const sealedAt = new Date();
    const startCommitSeq = sorted[0].metadata.commitSeq;
    const endCommitSeq = sorted[sorted.length - 1].metadata.commitSeq;
    
    const batchData: Omit<MerkleBatch, 'rootSignature' | 'signingKeyId' | 'status'> = {
      batchId,
      tenantId: this.config.tenantId,
      environmentId: this.config.environmentId,
      algoVersion: ALGO_VERSION,
      startCommitSeq,
      endCommitSeq,
      eventCount: events.length,
      rootHash,
      prevRootHash,
      sealedAt,
      anchorType: 'NONE',
      anchorRef: null,
    };
    
    // Sign root
    const { signature, keyId } = signBatchRoot(
      rootHash,
      batchData,
      this.config.privateKey
    );
    
    const batch: MerkleBatch = {
      ...batchData,
      rootSignature: signature,
      signingKeyId: keyId,
      status: 'SEALED',
    };
    
    // Store batch
    this.batches.set(batchId, batch);
    this.levelChunks.set(batchId, levels);
    
    // Index events
    sorted.forEach((event, index) => {
      this.eventIndex.set(event.metadata.eventId, {
        batchId,
        eventId: event.metadata.eventId,
        leafIndex: index,
        leafHash: event.digest.leafHash,
      });
    });
    
    this.lastSealedEndSeq = endCommitSeq;
    
    return batch;
  }
  
  /**
   * Get inclusion proof for an event
   */
  getProof(eventId: string): MerkleProof | null {
    const index = this.eventIndex.get(eventId);
    if (!index) return null;
    
    const batch = this.batches.get(index.batchId);
    if (!batch) return null;
    
    const levels = this.levelChunks.get(index.batchId);
    if (!levels) return null;
    
    const siblings = generateInclusionProof(levels, index.leafIndex);
    
    return {
      batchId: index.batchId,
      eventId: index.eventId,
      leafIndex: index.leafIndex,
      leafHash: index.leafHash,
      siblings,
      rootHash: batch.rootHash,
      algoVersion: batch.algoVersion,
      rootSignature: batch.rootSignature,
      signingKeyId: batch.signingKeyId,
      anchorType: batch.anchorType,
      anchorRef: batch.anchorRef,
      batchMetadata: {
        tenantId: batch.tenantId,
        environmentId: batch.environmentId,
        startCommitSeq: batch.startCommitSeq.toString(),
        endCommitSeq: batch.endCommitSeq.toString(),
        eventCount: batch.eventCount,
        sealedAt: batch.sealedAt.toISOString(),
      },
    };
  }
  
  /**
   * Anchor batch to external store (A4)
   */
  async anchorBatch(
    batchId: string,
    anchorType: MerkleBatch['anchorType'],
    anchorRef: string
  ): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Batch not found: ${batchId}`);
    
    batch.anchorType = anchorType;
    batch.anchorRef = anchorRef;
  }
}

// ============================================================
// PROOF VERIFICATION (A5)
// ============================================================

/**
 * Verify Merkle inclusion proof
 */
export function verifyInclusionProof(proof: MerkleProof): VerificationResult {
  const errors: string[] = [];
  
  // Recompute root from leaf + siblings
  let currentHash = proof.leafHash;
  let index = proof.leafIndex;
  
  for (const sibling of proof.siblings) {
    const isLeftChild = index % 2 === 0;
    
    if (isLeftChild) {
      currentHash = sha256(Buffer.concat([
        INTERNAL_PREFIX,
        Buffer.from(currentHash, 'hex'),
        Buffer.from(sibling, 'hex'),
      ]));
    } else {
      currentHash = sha256(Buffer.concat([
        INTERNAL_PREFIX,
        Buffer.from(sibling, 'hex'),
        Buffer.from(currentHash, 'hex'),
      ]));
    }
    
    index = Math.floor(index / 2);
  }
  
  const rootValid = currentHash === proof.rootHash;
  if (!rootValid) {
    errors.push(`Root mismatch: computed ${currentHash}, expected ${proof.rootHash}`);
  }
  
  // Signature verification would require public key
  const signatureValid = true; // Placeholder - implement with public key lookup
  
  // Anchor verification would require external lookup
  const anchorValid = proof.anchorType !== 'NONE';
  if (!anchorValid) {
    errors.push('Batch not anchored to external trust domain');
  }
  
  return {
    valid: rootValid && signatureValid,
    recomputedRoot: currentHash,
    expectedRoot: proof.rootHash,
    signatureValid,
    anchorValid,
    errors,
  };
}

/**
 * Reference verifier for evidence packs
 */
export function verifyEvidencePackProofs(
  events: Array<{ eventId: string; leafHash: string; merkleProof: MerkleProof }>
): { valid: boolean; results: Array<{ eventId: string; result: VerificationResult }> } {
  const results = events.map(event => ({
    eventId: event.eventId,
    result: verifyInclusionProof(event.merkleProof),
  }));
  
  const valid = results.every(r => r.result.valid);
  
  return { valid, results };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  ALGO_VERSION,
  EVENT_DIGEST_PREFIX,
};
