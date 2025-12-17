/**
 * Merkle Sealer Bootstrap
 * 
 * Configuration and initialization for the Merkle sealing worker.
 * This module provides:
 * - Environment-based configuration
 * - Database adapter for Postgres
 * - KMS signing adapter
 * - S3 anchoring adapter
 * - Scheduler setup
 */

import { randomUUID } from 'crypto';
import {
  MerkleSealerWorker,
  SealerConfig,
  SealerDatabase,
  UnsealedEvent,
  SealedBatch,
  MerkleEventIndex,
  createSealerScheduler,
  SealerScheduler,
} from './MerkleSealerWorker';
import {
  S3AnchorService,
  S3AnchorConfig,
  S3ClientInterface,
  MockS3Client,
} from './S3Anchoring';

// ============================================================
// ENVIRONMENT CONFIGURATION
// ============================================================

export interface SealerEnvironmentConfig {
  // Tenant/Environment
  TENANT_ID: string;
  ENVIRONMENT_ID: string;
  
  // Batch settings
  MERKLE_MIN_BATCH_SIZE: number;
  MERKLE_MAX_BATCH_SIZE: number;
  MERKLE_GRACE_WINDOW_SECONDS: number;
  MERKLE_SEAL_INTERVAL_MS: number;
  
  // Signing
  MERKLE_SIGNING_KEY_ID: string;
  MERKLE_ALGO_VERSION: string;
  
  // Anchoring
  MERKLE_ANCHOR_TYPE: 'WORM' | 'RFC3161' | 'TRANSPARENCY_LOG' | 'NONE';
  MERKLE_S3_BUCKET?: string;
  MERKLE_S3_PREFIX?: string;
  MERKLE_S3_REGION?: string;
  MERKLE_S3_OBJECT_LOCK_ENABLED?: boolean;
  MERKLE_S3_RETENTION_YEARS?: number;
  
  // KMS
  KMS_PROVIDER?: 'aws' | 'vault' | 'local';
  KMS_KEY_ARN?: string;
}

export function loadConfigFromEnv(): SealerEnvironmentConfig {
  return {
    TENANT_ID: process.env.TENANT_ID || 'default',
    ENVIRONMENT_ID: process.env.ENVIRONMENT_ID || 'development',
    
    MERKLE_MIN_BATCH_SIZE: parseInt(process.env.MERKLE_MIN_BATCH_SIZE || '10', 10),
    MERKLE_MAX_BATCH_SIZE: parseInt(process.env.MERKLE_MAX_BATCH_SIZE || '10000', 10),
    MERKLE_GRACE_WINDOW_SECONDS: parseInt(process.env.MERKLE_GRACE_WINDOW_SECONDS || '60', 10),
    MERKLE_SEAL_INTERVAL_MS: parseInt(process.env.MERKLE_SEAL_INTERVAL_MS || '60000', 10),
    
    MERKLE_SIGNING_KEY_ID: process.env.MERKLE_SIGNING_KEY_ID || 'k-merkle-root-default',
    MERKLE_ALGO_VERSION: process.env.MERKLE_ALGO_VERSION || 'SHA256_MERKLE_V1',
    
    MERKLE_ANCHOR_TYPE: (process.env.MERKLE_ANCHOR_TYPE || 'NONE') as any,
    MERKLE_S3_BUCKET: process.env.MERKLE_S3_BUCKET,
    MERKLE_S3_PREFIX: process.env.MERKLE_S3_PREFIX || 'merkle-anchors',
    MERKLE_S3_REGION: process.env.MERKLE_S3_REGION || 'us-east-1',
    MERKLE_S3_OBJECT_LOCK_ENABLED: process.env.MERKLE_S3_OBJECT_LOCK_ENABLED === 'true',
    MERKLE_S3_RETENTION_YEARS: parseInt(process.env.MERKLE_S3_RETENTION_YEARS || '7', 10),
    
    KMS_PROVIDER: (process.env.KMS_PROVIDER || 'local') as any,
    KMS_KEY_ARN: process.env.KMS_KEY_ARN,
  };
}

// ============================================================
// DATABASE ADAPTER (POSTGRES)
// ============================================================

export interface PostgresClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export function createPostgresSealerDatabase(pg: PostgresClient): SealerDatabase {
  return {
    async getUnsealedEvents(
      tenantId: string,
      environmentId: string,
      maxCommitSeq: number,
      limit: number
    ): Promise<UnsealedEvent[]> {
      const sql = `
        SELECT 
          e.event_id,
          e.commit_seq,
          e.leaf_hash,
          e.occurred_at
        FROM turing_core.events e
        LEFT JOIN turing_audit.merkle_event_index mei 
          ON mei.event_id = e.event_id
        WHERE e.tenant_id = $1
          AND e.environment_id = $2
          AND e.commit_seq <= $3
          AND e.leaf_hash IS NOT NULL
          AND mei.event_id IS NULL
        ORDER BY e.commit_seq ASC
        LIMIT $4
      `;
      
      const result = await pg.query<{
        event_id: string;
        commit_seq: number;
        leaf_hash: string;
        occurred_at: Date;
      }>(sql, [tenantId, environmentId, maxCommitSeq, limit]);
      
      return result.rows.map(row => ({
        eventId: row.event_id,
        commitSeq: row.commit_seq,
        leafHash: row.leaf_hash,
        occurredAt: row.occurred_at,
      }));
    },
    
    async getLastSealedBatch(
      tenantId: string,
      environmentId: string
    ): Promise<SealedBatch | null> {
      const sql = `
        SELECT *
        FROM turing_audit.merkle_batch
        WHERE tenant_id = $1
          AND environment_id = $2
          AND status = 'SEALED'
        ORDER BY sealed_at DESC
        LIMIT 1
      `;
      
      const result = await pg.query(sql, [tenantId, environmentId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        batchId: row.batch_id,
        tenantId: row.tenant_id,
        environmentId: row.environment_id,
        algoVersion: row.algo_version,
        startCommitSeq: row.start_commit_seq,
        endCommitSeq: row.end_commit_seq,
        eventCount: row.event_count,
        rootHash: row.root_hash,
        prevRootHash: row.prev_root_hash,
        sealedAt: row.sealed_at,
        rootSignature: row.root_signature,
        signingKeyId: row.signing_key_id,
        anchorType: row.anchor_type,
        anchorRef: row.anchor_ref,
        status: row.status,
      };
    },
    
    async writeSealedBatch(
      batch: SealedBatch,
      eventIndex: MerkleEventIndex[],
      levelChunks: Array<{
        batchId: string;
        level: number;
        chunkIndex: number;
        hashCount: number;
        hashesBlob: Buffer;
      }>
    ): Promise<void> {
      // Use transaction for atomicity
      await pg.query('BEGIN');
      
      try {
        // Insert batch
        await pg.query(`
          INSERT INTO turing_audit.merkle_batch (
            batch_id, tenant_id, environment_id, algo_version,
            start_commit_seq, end_commit_seq, event_count,
            root_hash, prev_root_hash, sealed_at,
            root_signature, signing_key_id, anchor_type, anchor_ref, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          batch.batchId, batch.tenantId, batch.environmentId, batch.algoVersion,
          batch.startCommitSeq, batch.endCommitSeq, batch.eventCount,
          batch.rootHash, batch.prevRootHash, batch.sealedAt,
          batch.rootSignature, batch.signingKeyId, batch.anchorType, batch.anchorRef, batch.status,
        ]);
        
        // Insert event index entries
        for (const idx of eventIndex) {
          await pg.query(`
            INSERT INTO turing_audit.merkle_event_index (
              tenant_id, environment_id, batch_id, event_id, leaf_index, leaf_hash
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [idx.tenantId, idx.environmentId, idx.batchId, idx.eventId, idx.leafIndex, idx.leafHash]);
        }
        
        // Insert level chunks
        for (const chunk of levelChunks) {
          await pg.query(`
            INSERT INTO turing_audit.merkle_level_chunk (
              batch_id, level, chunk_index, hash_count, hashes_blob
            ) VALUES ($1, $2, $3, $4, $5)
          `, [chunk.batchId, chunk.level, chunk.chunkIndex, chunk.hashCount, chunk.hashesBlob]);
        }
        
        await pg.query('COMMIT');
      } catch (err) {
        await pg.query('ROLLBACK');
        throw err;
      }
    },
    
    async getMaxCommitSeq(tenantId: string, environmentId: string): Promise<number> {
      const sql = `
        SELECT COALESCE(MAX(commit_seq), 0) as max_seq
        FROM turing_core.events
        WHERE tenant_id = $1 AND environment_id = $2
      `;
      
      const result = await pg.query<{ max_seq: number }>(sql, [tenantId, environmentId]);
      return result.rows[0]?.max_seq || 0;
    },
  };
}

// ============================================================
// KMS SIGNING ADAPTER
// ============================================================

export interface KMSSigningKey {
  sign(data: Buffer): Promise<Buffer>;
}

/**
 * Create signing key adapter.
 * In production, this would call AWS KMS or HashiCorp Vault.
 */
export function createSigningKeyProvider(
  config: SealerEnvironmentConfig
): (keyId: string) => Promise<KMSSigningKey> {
  if (config.KMS_PROVIDER === 'local') {
    // Local signing for development/testing
    // In production, NEVER use this - use KMS/HSM
    const { createPrivateKey, sign } = require('crypto');
    const { generateKeyPairSync } = require('crypto');
    
    // Generate ephemeral key (FOR TESTING ONLY)
    const keyCache = new Map<string, { privateKey: any }>();
    
    return async (keyId: string) => {
      if (!keyCache.has(keyId)) {
        const { privateKey } = generateKeyPairSync('ed25519');
        keyCache.set(keyId, { privateKey });
        console.warn(`[KMS] Generated ephemeral key for ${keyId} - FOR TESTING ONLY`);
      }
      
      const { privateKey } = keyCache.get(keyId)!;
      
      return {
        async sign(data: Buffer): Promise<Buffer> {
          return sign(null, data, privateKey);
        },
      };
    };
  }
  
  if (config.KMS_PROVIDER === 'aws') {
    // AWS KMS integration
    return async (keyId: string) => {
      // In production, use @aws-sdk/client-kms
      // const { KMSClient, SignCommand } = require('@aws-sdk/client-kms');
      // const kms = new KMSClient({ region: config.MERKLE_S3_REGION });
      
      throw new Error('AWS KMS integration not implemented - add @aws-sdk/client-kms');
    };
  }
  
  throw new Error(`Unknown KMS provider: ${config.KMS_PROVIDER}`);
}

// ============================================================
// BOOTSTRAP FUNCTION
// ============================================================

export interface SealerBootstrapResult {
  worker: MerkleSealerWorker;
  scheduler: SealerScheduler;
  config: SealerConfig;
}

export async function bootstrapMerkleSealer(
  envConfig: SealerEnvironmentConfig,
  pgClient: PostgresClient,
  s3Client?: S3ClientInterface
): Promise<SealerBootstrapResult> {
  // Build sealer config
  const config: SealerConfig = {
    tenantId: envConfig.TENANT_ID,
    environmentId: envConfig.ENVIRONMENT_ID,
    minBatchSize: envConfig.MERKLE_MIN_BATCH_SIZE,
    maxBatchSize: envConfig.MERKLE_MAX_BATCH_SIZE,
    graceWindowSeconds: envConfig.MERKLE_GRACE_WINDOW_SECONDS,
    signingKeyId: envConfig.MERKLE_SIGNING_KEY_ID,
    algoVersion: envConfig.MERKLE_ALGO_VERSION,
    anchoring: {
      type: envConfig.MERKLE_ANCHOR_TYPE,
      s3Bucket: envConfig.MERKLE_S3_BUCKET,
      s3Prefix: envConfig.MERKLE_S3_PREFIX,
      objectLockEnabled: envConfig.MERKLE_S3_OBJECT_LOCK_ENABLED,
    },
  };
  
  // Create database adapter
  const db = createPostgresSealerDatabase(pgClient);
  
  // Create signing key provider
  const getSigningKey = createSigningKeyProvider(envConfig);
  
  // Create S3 client if anchoring is enabled
  let s3: S3ClientInterface | undefined = s3Client;
  if (envConfig.MERKLE_ANCHOR_TYPE === 'WORM' && !s3) {
    if (envConfig.MERKLE_S3_BUCKET) {
      // In production, use @aws-sdk/client-s3
      // s3 = new S3Client({ region: envConfig.MERKLE_S3_REGION });
      console.warn('[S3] Using mock S3 client - add @aws-sdk/client-s3 for production');
      s3 = new MockS3Client();
    }
  }
  
  // Create worker
  const worker = new MerkleSealerWorker(config, db, getSigningKey, s3);
  
  // Create scheduler
  const scheduler = createSealerScheduler(worker);
  
  return { worker, scheduler, config };
}

// ============================================================
// STARTUP SCRIPT
// ============================================================

/**
 * Start the Merkle sealer as a background service.
 * Call this from your server startup.
 */
export async function startMerkleSealer(
  pgClient: PostgresClient,
  options?: {
    autoStart?: boolean;
    s3Client?: S3ClientInterface;
  }
): Promise<SealerBootstrapResult> {
  const envConfig = loadConfigFromEnv();
  
  console.log('[MerkleSealer] Bootstrapping with config:', {
    tenantId: envConfig.TENANT_ID,
    environmentId: envConfig.ENVIRONMENT_ID,
    minBatchSize: envConfig.MERKLE_MIN_BATCH_SIZE,
    maxBatchSize: envConfig.MERKLE_MAX_BATCH_SIZE,
    intervalMs: envConfig.MERKLE_SEAL_INTERVAL_MS,
    anchorType: envConfig.MERKLE_ANCHOR_TYPE,
  });
  
  const result = await bootstrapMerkleSealer(envConfig, pgClient, options?.s3Client);
  
  if (options?.autoStart !== false) {
    result.scheduler.start(envConfig.MERKLE_SEAL_INTERVAL_MS);
    console.log(`[MerkleSealer] Scheduler started with interval ${envConfig.MERKLE_SEAL_INTERVAL_MS}ms`);
  }
  
  return result;
}

// ============================================================
// EXPORTS
// ============================================================

export { MerkleSealerWorker, SealerScheduler };
