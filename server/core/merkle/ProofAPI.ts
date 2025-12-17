/**
 * Merkle Proof API
 * 
 * Provides endpoints for:
 * - GET /proofs/merkle/events/:event_id - Get inclusion proof for an event
 * - GET /proofs/merkle/batches/:batch_id - Get batch metadata
 * - POST /proofs/merkle/verify - Verify an inclusion proof
 * 
 * These endpoints enable external auditors to verify event integrity
 * without access to the full database.
 */

import { createHash } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface InclusionProofResponse {
  schema: string;
  event_id: string;
  batch_id: string;
  leaf_index: number;
  leaf_hash: string;
  siblings: string[];
  root_hash: string;
  root_signature: string;
  signing_key_id: string;
  anchor_type: string;
  anchor_ref: string | null;
  sealed_at: string;
  verified: boolean;
}

export interface BatchMetadataResponse {
  schema: string;
  batch_id: string;
  tenant_id: string;
  environment_id: string;
  algo_version: string;
  start_commit_seq: number;
  end_commit_seq: number;
  event_count: number;
  root_hash: string;
  prev_root_hash: string | null;
  sealed_at: string;
  root_signature: string;
  signing_key_id: string;
  anchor_type: string;
  anchor_ref: string | null;
  status: string;
}

export interface VerifyProofRequest {
  leaf_hash: string;
  leaf_index: number;
  siblings: string[];
  root_hash: string;
}

export interface VerifyProofResponse {
  valid: boolean;
  computed_root: string;
  expected_root: string;
  error?: string;
}

// ============================================================
// DATABASE INTERFACE
// ============================================================

export interface ProofDatabase {
  /**
   * Get event index entry for an event.
   */
  getEventIndex(eventId: string): Promise<{
    tenantId: string;
    environmentId: string;
    batchId: string;
    eventId: string;
    leafIndex: number;
    leafHash: string;
  } | null>;
  
  /**
   * Get batch metadata.
   */
  getBatch(batchId: string): Promise<{
    batchId: string;
    tenantId: string;
    environmentId: string;
    algoVersion: string;
    startCommitSeq: number;
    endCommitSeq: number;
    eventCount: number;
    rootHash: string;
    prevRootHash: string | null;
    sealedAt: Date;
    rootSignature: string;
    signingKeyId: string;
    anchorType: string;
    anchorRef: string | null;
    status: string;
  } | null>;
  
  /**
   * Get level chunks for proof generation.
   */
  getLevelChunks(batchId: string): Promise<Array<{
    level: number;
    chunkIndex: number;
    hashCount: number;
    hashesBlob: Buffer;
  }>>;
}

// ============================================================
// MERKLE PROOF OPERATIONS
// ============================================================

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function parentHash(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([NODE_PREFIX, left, right]));
}

/**
 * Reconstruct Merkle tree levels from stored chunks.
 */
function reconstructLevels(chunks: Array<{
  level: number;
  chunkIndex: number;
  hashCount: number;
  hashesBlob: Buffer;
}>): Buffer[][] {
  // Group by level
  const levelMap = new Map<number, Buffer[]>();
  
  // Sort chunks by level and chunk index
  const sortedChunks = [...chunks].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.chunkIndex - b.chunkIndex;
  });
  
  for (const chunk of sortedChunks) {
    if (!levelMap.has(chunk.level)) {
      levelMap.set(chunk.level, []);
    }
    
    // Extract 32-byte hashes from blob
    const hashes = levelMap.get(chunk.level)!;
    for (let i = 0; i < chunk.hashCount; i++) {
      const hash = chunk.hashesBlob.subarray(i * 32, (i + 1) * 32);
      hashes.push(Buffer.from(hash));
    }
  }
  
  // Convert to array of levels
  const maxLevel = Math.max(...levelMap.keys());
  const levels: Buffer[][] = [];
  
  for (let i = 0; i <= maxLevel; i++) {
    levels.push(levelMap.get(i) || []);
  }
  
  return levels;
}

/**
 * Generate inclusion proof from reconstructed levels.
 */
function generateProof(levels: Buffer[][], leafIndex: number): Buffer[] {
  const proof: Buffer[] = [];
  let idx = leafIndex;
  
  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];
    
    if (idx % 2 === 0) {
      const siblingIdx = idx + 1;
      if (siblingIdx < currentLevel.length) {
        proof.push(currentLevel[siblingIdx]);
      } else {
        proof.push(currentLevel[idx]);
      }
    } else {
      proof.push(currentLevel[idx - 1]);
    }
    
    idx = Math.floor(idx / 2);
  }
  
  return proof;
}

/**
 * Verify an inclusion proof.
 */
function verifyProof(
  leafHash: Buffer,
  leafIndex: number,
  siblings: Buffer[],
  rootHash: Buffer
): { valid: boolean; computedRoot: Buffer } {
  let current = leafHash;
  let idx = leafIndex;
  
  for (const sibling of siblings) {
    if (idx % 2 === 0) {
      current = parentHash(current, sibling);
    } else {
      current = parentHash(sibling, current);
    }
    idx = Math.floor(idx / 2);
  }
  
  return {
    valid: current.equals(rootHash),
    computedRoot: current,
  };
}

// ============================================================
// PROOF API SERVICE
// ============================================================

export class ProofAPIService {
  private db: ProofDatabase;
  
  constructor(db: ProofDatabase) {
    this.db = db;
  }
  
  /**
   * Get inclusion proof for an event.
   */
  async getEventProof(eventId: string): Promise<InclusionProofResponse | null> {
    // Get event index
    const eventIndex = await this.db.getEventIndex(eventId);
    if (!eventIndex) {
      return null;
    }
    
    // Get batch metadata
    const batch = await this.db.getBatch(eventIndex.batchId);
    if (!batch) {
      return null;
    }
    
    // Get level chunks
    const chunks = await this.db.getLevelChunks(eventIndex.batchId);
    if (chunks.length === 0) {
      return null;
    }
    
    // Reconstruct levels and generate proof
    const levels = reconstructLevels(chunks);
    const siblings = generateProof(levels, eventIndex.leafIndex);
    
    // Verify the proof
    const leafHash = Buffer.from(eventIndex.leafHash, 'hex');
    const rootHash = Buffer.from(batch.rootHash, 'hex');
    const { valid } = verifyProof(leafHash, eventIndex.leafIndex, siblings, rootHash);
    
    return {
      schema: 'TD:INCLUSION_PROOF:v1',
      event_id: eventId,
      batch_id: eventIndex.batchId,
      leaf_index: eventIndex.leafIndex,
      leaf_hash: eventIndex.leafHash,
      siblings: siblings.map(s => s.toString('hex')),
      root_hash: batch.rootHash,
      root_signature: batch.rootSignature,
      signing_key_id: batch.signingKeyId,
      anchor_type: batch.anchorType,
      anchor_ref: batch.anchorRef,
      sealed_at: batch.sealedAt.toISOString(),
      verified: valid,
    };
  }
  
  /**
   * Get batch metadata.
   */
  async getBatchMetadata(batchId: string): Promise<BatchMetadataResponse | null> {
    const batch = await this.db.getBatch(batchId);
    if (!batch) {
      return null;
    }
    
    return {
      schema: 'TD:BATCH_METADATA:v1',
      batch_id: batch.batchId,
      tenant_id: batch.tenantId,
      environment_id: batch.environmentId,
      algo_version: batch.algoVersion,
      start_commit_seq: batch.startCommitSeq,
      end_commit_seq: batch.endCommitSeq,
      event_count: batch.eventCount,
      root_hash: batch.rootHash,
      prev_root_hash: batch.prevRootHash,
      sealed_at: batch.sealedAt.toISOString(),
      root_signature: batch.rootSignature,
      signing_key_id: batch.signingKeyId,
      anchor_type: batch.anchorType,
      anchor_ref: batch.anchorRef,
      status: batch.status,
    };
  }
  
  /**
   * Verify an inclusion proof (stateless).
   */
  verifyProof(request: VerifyProofRequest): VerifyProofResponse {
    try {
      const leafHash = Buffer.from(request.leaf_hash, 'hex');
      const siblings = request.siblings.map(s => Buffer.from(s, 'hex'));
      const rootHash = Buffer.from(request.root_hash, 'hex');
      
      const { valid, computedRoot } = verifyProof(
        leafHash,
        request.leaf_index,
        siblings,
        rootHash
      );
      
      return {
        valid,
        computed_root: computedRoot.toString('hex'),
        expected_root: request.root_hash,
      };
    } catch (err: any) {
      return {
        valid: false,
        computed_root: '',
        expected_root: request.root_hash,
        error: err.message,
      };
    }
  }
}

// ============================================================
// tRPC ROUTER (EXAMPLE)
// ============================================================

/**
 * Example tRPC router for proof API.
 * Integrate this into your existing tRPC setup.
 */
export function createProofRouterExample() {
  // This is a template - integrate with your actual tRPC setup
  return {
    // GET /proofs/merkle/events/:event_id
    getEventProof: {
      input: { eventId: 'string' },
      handler: async (input: { eventId: string }, service: ProofAPIService) => {
        const proof = await service.getEventProof(input.eventId);
        if (!proof) {
          throw new Error('Event not found or not yet sealed');
        }
        return proof;
      },
    },
    
    // GET /proofs/merkle/batches/:batch_id
    getBatchMetadata: {
      input: { batchId: 'string' },
      handler: async (input: { batchId: string }, service: ProofAPIService) => {
        const batch = await service.getBatchMetadata(input.batchId);
        if (!batch) {
          throw new Error('Batch not found');
        }
        return batch;
      },
    },
    
    // POST /proofs/merkle/verify
    verifyProof: {
      input: {
        leaf_hash: 'string',
        leaf_index: 'number',
        siblings: 'string[]',
        root_hash: 'string',
      },
      handler: (input: VerifyProofRequest, service: ProofAPIService) => {
        return service.verifyProof(input);
      },
    },
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  reconstructLevels,
  generateProof,
  verifyProof,
};
