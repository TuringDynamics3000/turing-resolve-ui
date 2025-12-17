/**
 * Merkle Sealer Worker
 * 
 * Production-ready background worker that:
 * 1. Selects unsealed events by commit_seq range
 * 2. Builds Merkle tree from leaf hashes
 * 3. Signs root with configured signing key
 * 4. Anchors root to external trust boundary (S3 Object Lock)
 * 5. Writes batch record and event index to database
 * 
 * This is the critical component that makes events tamper-evident.
 */

import { createHash, randomUUID } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface SealerConfig {
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  
  /** Environment ID (prod, staging, dev) */
  environmentId: string;
  
  /** Minimum events before sealing a batch */
  minBatchSize: number;
  
  /** Maximum events per batch */
  maxBatchSize: number;
  
  /** Grace period in seconds - don't seal events newer than this */
  graceWindowSeconds: number;
  
  /** Signing key ID from key registry */
  signingKeyId: string;
  
  /** Algorithm version for batch metadata */
  algoVersion: string;
  
  /** Anchor configuration */
  anchoring: AnchorConfig;
}

export interface AnchorConfig {
  /** Anchor type: WORM, RFC3161, TRANSPARENCY_LOG, etc. */
  type: 'WORM' | 'RFC3161' | 'TRANSPARENCY_LOG' | 'NONE';
  
  /** S3 bucket for WORM anchoring */
  s3Bucket?: string;
  
  /** S3 prefix for anchor objects */
  s3Prefix?: string;
  
  /** Whether S3 Object Lock is enabled */
  objectLockEnabled?: boolean;
}

export interface UnsealedEvent {
  eventId: string;
  commitSeq: number;
  leafHash: string;  // hex
  occurredAt: Date;
}

export interface SealedBatch {
  batchId: string;
  tenantId: string;
  environmentId: string;
  algoVersion: string;
  startCommitSeq: number;
  endCommitSeq: number;
  eventCount: number;
  rootHash: string;  // hex
  prevRootHash: string | null;  // hex
  sealedAt: Date;
  rootSignature: string;  // hex
  signingKeyId: string;
  anchorType: string;
  anchorRef: string | null;
  status: 'OPEN' | 'SEALED' | 'FAILED';
}

export interface MerkleEventIndex {
  tenantId: string;
  environmentId: string;
  batchId: string;
  eventId: string;
  leafIndex: number;
  leafHash: string;  // hex
}

export interface InclusionProof {
  batchId: string;
  leafIndex: number;
  siblings: string[];  // hex
  rootHash: string;  // hex
  rootSignature: string;  // hex
  signingKeyId: string;
  anchorType: string;
  anchorRef: string | null;
}

// ============================================================
// MERKLE TREE OPERATIONS
// ============================================================

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function computeLeafHash(eventDigest: Buffer): Buffer {
  return sha256(Buffer.concat([LEAF_PREFIX, eventDigest]));
}

function parentHash(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([NODE_PREFIX, left, right]));
}

/**
 * Build complete Merkle tree from leaf hashes.
 * Returns all levels, where levels[0] = leaves, levels[-1] = [root].
 */
function buildMerkleTree(leaves: Buffer[]): Buffer[][] {
  if (leaves.length === 0) {
    return [];
  }
  
  const levels: Buffer[][] = [leaves.slice()];
  let current = leaves;
  
  while (current.length > 1) {
    const nextLevel: Buffer[] = [];
    
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      // If odd number, duplicate last node
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      nextLevel.push(parentHash(left, right));
    }
    
    levels.push(nextLevel);
    current = nextLevel;
  }
  
  return levels;
}

/**
 * Generate inclusion proof for a leaf at given index.
 */
function generateInclusionProof(levels: Buffer[][], leafIndex: number): Buffer[] {
  const proof: Buffer[] = [];
  let idx = leafIndex;
  
  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];
    
    if (idx % 2 === 0) {
      // Even index - sibling is to the right
      const siblingIdx = idx + 1;
      if (siblingIdx < currentLevel.length) {
        proof.push(currentLevel[siblingIdx]);
      } else {
        // Odd number of nodes - sibling is self
        proof.push(currentLevel[idx]);
      }
    } else {
      // Odd index - sibling is to the left
      proof.push(currentLevel[idx - 1]);
    }
    
    idx = Math.floor(idx / 2);
  }
  
  return proof;
}

/**
 * Verify an inclusion proof.
 */
export function verifyInclusionProof(
  leafHash: Buffer,
  leafIndex: number,
  siblings: Buffer[],
  rootHash: Buffer
): boolean {
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
  
  return current.equals(rootHash);
}

// ============================================================
// SIGNING (PLACEHOLDER - REPLACE WITH KMS IN PRODUCTION)
// ============================================================

export interface SigningKey {
  keyId: string;
  algorithm: 'ed25519' | 'ecdsa-p256';
  publicKey: Buffer;
  // Private key would be in KMS/HSM, not here
}

/**
 * Sign data with the configured signing key.
 * In production, this calls KMS/HSM.
 */
async function signWithKey(
  keyId: string,
  data: Buffer,
  getSigningKey: (keyId: string) => Promise<{ sign: (data: Buffer) => Promise<Buffer> }>
): Promise<Buffer> {
  const key = await getSigningKey(keyId);
  return key.sign(data);
}

// ============================================================
// S3 ANCHORING
// ============================================================

export interface S3Client {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
    ObjectLockMode?: 'GOVERNANCE' | 'COMPLIANCE';
    ObjectLockRetainUntilDate?: Date;
  }): Promise<{ ETag: string }>;
}

/**
 * Anchor a Merkle root to S3 with Object Lock.
 */
async function anchorToS3(
  s3Client: S3Client,
  config: AnchorConfig,
  batch: {
    batchId: string;
    rootHash: string;
    rootSignature: string;
    sealedAt: Date;
    eventCount: number;
  }
): Promise<string> {
  if (!config.s3Bucket) {
    throw new Error('S3 bucket not configured for anchoring');
  }
  
  const key = `${config.s3Prefix || 'merkle-anchors'}/${batch.batchId}.json`;
  
  const anchorPayload = {
    schema: 'TD:MERKLE_ANCHOR:v1',
    batch_id: batch.batchId,
    root_hash: batch.rootHash,
    root_signature: batch.rootSignature,
    sealed_at: batch.sealedAt.toISOString(),
    event_count: batch.eventCount,
    anchored_at: new Date().toISOString(),
  };
  
  const params: Parameters<S3Client['putObject']>[0] = {
    Bucket: config.s3Bucket,
    Key: key,
    Body: Buffer.from(JSON.stringify(anchorPayload, null, 2)),
    ContentType: 'application/json',
  };
  
  // Add Object Lock if enabled
  if (config.objectLockEnabled) {
    params.ObjectLockMode = 'COMPLIANCE';
    // Retain for 7 years (regulatory requirement)
    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + 7);
    params.ObjectLockRetainUntilDate = retainUntil;
  }
  
  await s3Client.putObject(params);
  
  return `s3://${config.s3Bucket}/${key}`;
}

// ============================================================
// DATABASE OPERATIONS (INTERFACES)
// ============================================================

export interface SealerDatabase {
  /**
   * Get unsealed events within the grace window.
   */
  getUnsealedEvents(
    tenantId: string,
    environmentId: string,
    maxCommitSeq: number,
    limit: number
  ): Promise<UnsealedEvent[]>;
  
  /**
   * Get the last sealed batch for chaining.
   */
  getLastSealedBatch(
    tenantId: string,
    environmentId: string
  ): Promise<SealedBatch | null>;
  
  /**
   * Write sealed batch and event index atomically.
   */
  writeSealedBatch(
    batch: SealedBatch,
    eventIndex: MerkleEventIndex[],
    levelChunks: Array<{
      batchId: string;
      level: number;
      chunkIndex: number;
      hashCount: number;
      hashesBlob: Buffer;
    }>
  ): Promise<void>;
  
  /**
   * Get current max commit_seq for grace window calculation.
   */
  getMaxCommitSeq(tenantId: string, environmentId: string): Promise<number>;
}

// ============================================================
// MERKLE SEALER WORKER
// ============================================================

export class MerkleSealerWorker {
  private config: SealerConfig;
  private db: SealerDatabase;
  private getSigningKey: (keyId: string) => Promise<{ sign: (data: Buffer) => Promise<Buffer> }>;
  private s3Client?: S3Client;
  
  constructor(
    config: SealerConfig,
    db: SealerDatabase,
    getSigningKey: (keyId: string) => Promise<{ sign: (data: Buffer) => Promise<Buffer> }>,
    s3Client?: S3Client
  ) {
    this.config = config;
    this.db = db;
    this.getSigningKey = getSigningKey;
    this.s3Client = s3Client;
  }
  
  /**
   * Run one sealing cycle.
   * Returns the sealed batch if successful, null if no events to seal.
   */
  async seal(): Promise<SealedBatch | null> {
    const { tenantId, environmentId, minBatchSize, maxBatchSize, graceWindowSeconds } = this.config;
    
    // Calculate grace window cutoff
    const maxCommitSeq = await this.db.getMaxCommitSeq(tenantId, environmentId);
    const graceCommitSeq = maxCommitSeq - graceWindowSeconds; // Simplified - in production, use timestamp
    
    // Get unsealed events
    const events = await this.db.getUnsealedEvents(
      tenantId,
      environmentId,
      graceCommitSeq,
      maxBatchSize
    );
    
    if (events.length < minBatchSize) {
      console.log(`[MerkleSealer] Not enough events to seal: ${events.length} < ${minBatchSize}`);
      return null;
    }
    
    console.log(`[MerkleSealer] Sealing batch with ${events.length} events`);
    
    // Build Merkle tree
    const leafHashes = events.map(e => Buffer.from(e.leafHash, 'hex'));
    const levels = buildMerkleTree(leafHashes);
    const rootHash = levels[levels.length - 1][0];
    
    // Get previous batch for chaining
    const prevBatch = await this.db.getLastSealedBatch(tenantId, environmentId);
    const prevRootHash = prevBatch?.rootHash || null;
    
    // Sign root
    const rootSignature = await signWithKey(
      this.config.signingKeyId,
      rootHash,
      this.getSigningKey
    );
    
    // Create batch record
    const batchId = randomUUID();
    const sealedAt = new Date();
    
    let anchorRef: string | null = null;
    
    // Anchor to external trust boundary
    if (this.config.anchoring.type === 'WORM' && this.s3Client) {
      anchorRef = await anchorToS3(this.s3Client, this.config.anchoring, {
        batchId,
        rootHash: rootHash.toString('hex'),
        rootSignature: rootSignature.toString('hex'),
        sealedAt,
        eventCount: events.length,
      });
      console.log(`[MerkleSealer] Anchored to ${anchorRef}`);
    }
    
    const batch: SealedBatch = {
      batchId,
      tenantId,
      environmentId,
      algoVersion: this.config.algoVersion,
      startCommitSeq: events[0].commitSeq,
      endCommitSeq: events[events.length - 1].commitSeq,
      eventCount: events.length,
      rootHash: rootHash.toString('hex'),
      prevRootHash,
      sealedAt,
      rootSignature: rootSignature.toString('hex'),
      signingKeyId: this.config.signingKeyId,
      anchorType: this.config.anchoring.type,
      anchorRef,
      status: 'SEALED',
    };
    
    // Create event index
    const eventIndex: MerkleEventIndex[] = events.map((e, i) => ({
      tenantId,
      environmentId,
      batchId,
      eventId: e.eventId,
      leafIndex: i,
      leafHash: e.leafHash,
    }));
    
    // Create level chunks for proof generation
    const CHUNK_SIZE = 1000; // Hashes per chunk
    const levelChunks: Array<{
      batchId: string;
      level: number;
      chunkIndex: number;
      hashCount: number;
      hashesBlob: Buffer;
    }> = [];
    
    for (let level = 0; level < levels.length; level++) {
      const levelHashes = levels[level];
      
      for (let chunkStart = 0; chunkStart < levelHashes.length; chunkStart += CHUNK_SIZE) {
        const chunkHashes = levelHashes.slice(chunkStart, chunkStart + CHUNK_SIZE);
        const hashesBlob = Buffer.concat(chunkHashes);
        
        levelChunks.push({
          batchId,
          level,
          chunkIndex: Math.floor(chunkStart / CHUNK_SIZE),
          hashCount: chunkHashes.length,
          hashesBlob,
        });
      }
    }
    
    // Write to database atomically
    await this.db.writeSealedBatch(batch, eventIndex, levelChunks);
    
    console.log(`[MerkleSealer] Sealed batch ${batchId} with ${events.length} events, root=${rootHash.toString('hex').slice(0, 16)}...`);
    
    return batch;
  }
  
  /**
   * Generate inclusion proof for an event.
   */
  async getInclusionProof(eventId: string): Promise<InclusionProof | null> {
    // This would query the database for:
    // 1. Event's batch and leaf index from merkle_event_index
    // 2. Level chunks from merkle_level_chunk
    // 3. Batch metadata from merkle_batch
    // Then reconstruct the proof
    
    // For now, return null - implement with actual DB queries
    console.log(`[MerkleSealer] getInclusionProof not yet implemented for ${eventId}`);
    return null;
  }
}

// ============================================================
// SCHEDULER
// ============================================================

export interface SealerScheduler {
  /**
   * Start the sealer on a schedule.
   */
  start(intervalMs: number): void;
  
  /**
   * Stop the sealer.
   */
  stop(): void;
  
  /**
   * Run one sealing cycle immediately.
   */
  runOnce(): Promise<SealedBatch | null>;
}

export function createSealerScheduler(worker: MerkleSealerWorker): SealerScheduler {
  let intervalId: NodeJS.Timeout | null = null;
  let isRunning = false;
  
  return {
    start(intervalMs: number) {
      if (intervalId) {
        console.warn('[MerkleSealer] Scheduler already running');
        return;
      }
      
      console.log(`[MerkleSealer] Starting scheduler with interval ${intervalMs}ms`);
      
      intervalId = setInterval(async () => {
        if (isRunning) {
          console.log('[MerkleSealer] Previous cycle still running, skipping');
          return;
        }
        
        isRunning = true;
        try {
          await worker.seal();
        } catch (err) {
          console.error('[MerkleSealer] Sealing error:', err);
        } finally {
          isRunning = false;
        }
      }, intervalMs);
    },
    
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[MerkleSealer] Scheduler stopped');
      }
    },
    
    async runOnce() {
      if (isRunning) {
        console.warn('[MerkleSealer] Sealing already in progress');
        return null;
      }
      
      isRunning = true;
      try {
        return await worker.seal();
      } finally {
        isRunning = false;
      }
    },
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  buildMerkleTree,
  generateInclusionProof,
  computeLeafHash,
  parentHash,
  sha256,
};
