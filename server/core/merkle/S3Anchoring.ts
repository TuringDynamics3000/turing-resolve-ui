/**
 * S3 Object Lock Anchoring
 * 
 * Anchors Merkle roots to S3 with Object Lock (WORM - Write Once Read Many).
 * This creates an external trust boundary outside the database.
 * 
 * Why this matters:
 * - Database admins can modify database records
 * - S3 Object Lock in COMPLIANCE mode cannot be deleted, even by root
 * - If someone tampers with the database, the anchor won't match
 * - Auditors can verify roots against anchors independently
 * 
 * Requirements:
 * - S3 bucket with Object Lock enabled
 * - IAM permissions: s3:PutObject, s3:PutObjectRetention
 * - Bucket versioning enabled (required for Object Lock)
 */

import { createHash } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface AnchorPayload {
  schema: string;
  batch_id: string;
  tenant_id: string;
  environment_id: string;
  root_hash: string;
  root_signature: string;
  signing_key_id: string;
  sealed_at: string;
  event_count: number;
  start_commit_seq: number;
  end_commit_seq: number;
  prev_root_hash: string | null;
  anchored_at: string;
  anchor_hash: string;  // Hash of all fields above for integrity
}

export interface AnchorResult {
  anchorRef: string;
  anchorType: 'WORM';
  anchorPayload: AnchorPayload;
  etag: string;
  versionId?: string;
}

export interface S3AnchorConfig {
  bucket: string;
  prefix: string;
  region: string;
  objectLockEnabled: boolean;
  retentionYears: number;
}

// ============================================================
// S3 CLIENT INTERFACE
// ============================================================

export interface S3ClientInterface {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string;
    ContentType: string;
    Metadata?: Record<string, string>;
    ObjectLockMode?: 'GOVERNANCE' | 'COMPLIANCE';
    ObjectLockRetainUntilDate?: Date;
  }): Promise<{
    ETag: string;
    VersionId?: string;
  }>;
  
  getObject(params: {
    Bucket: string;
    Key: string;
    VersionId?: string;
  }): Promise<{
    Body: Buffer;
    ETag: string;
    VersionId?: string;
    Metadata?: Record<string, string>;
  }>;
  
  headObject(params: {
    Bucket: string;
    Key: string;
    VersionId?: string;
  }): Promise<{
    ETag: string;
    VersionId?: string;
    ObjectLockMode?: string;
    ObjectLockRetainUntilDate?: Date;
  }>;
}

// ============================================================
// ANCHOR SERVICE
// ============================================================

export class S3AnchorService {
  private config: S3AnchorConfig;
  private s3: S3ClientInterface;
  
  constructor(config: S3AnchorConfig, s3Client: S3ClientInterface) {
    this.config = config;
    this.s3 = s3Client;
  }
  
  /**
   * Anchor a Merkle batch root to S3 with Object Lock.
   */
  async anchor(batch: {
    batchId: string;
    tenantId: string;
    environmentId: string;
    rootHash: string;
    rootSignature: string;
    signingKeyId: string;
    sealedAt: Date;
    eventCount: number;
    startCommitSeq: number;
    endCommitSeq: number;
    prevRootHash: string | null;
  }): Promise<AnchorResult> {
    const anchoredAt = new Date().toISOString();
    
    // Build anchor payload (without anchor_hash first)
    const payloadWithoutHash = {
      schema: 'TD:MERKLE_ANCHOR:v1',
      batch_id: batch.batchId,
      tenant_id: batch.tenantId,
      environment_id: batch.environmentId,
      root_hash: batch.rootHash,
      root_signature: batch.rootSignature,
      signing_key_id: batch.signingKeyId,
      sealed_at: batch.sealedAt.toISOString(),
      event_count: batch.eventCount,
      start_commit_seq: batch.startCommitSeq,
      end_commit_seq: batch.endCommitSeq,
      prev_root_hash: batch.prevRootHash,
      anchored_at: anchoredAt,
    };
    
    // Compute anchor hash for integrity
    const anchorHash = this.computeAnchorHash(payloadWithoutHash);
    
    const payload: AnchorPayload = {
      ...payloadWithoutHash,
      anchor_hash: anchorHash,
    };
    
    // Build S3 key
    const key = this.buildKey(batch.tenantId, batch.environmentId, batch.batchId);
    
    // Prepare put params
    const putParams: Parameters<S3ClientInterface['putObject']>[0] = {
      Bucket: this.config.bucket,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'x-td-batch-id': batch.batchId,
        'x-td-root-hash': batch.rootHash.slice(0, 32),
        'x-td-event-count': String(batch.eventCount),
      },
    };
    
    // Add Object Lock if enabled
    if (this.config.objectLockEnabled) {
      putParams.ObjectLockMode = 'COMPLIANCE';
      
      const retainUntil = new Date();
      retainUntil.setFullYear(retainUntil.getFullYear() + this.config.retentionYears);
      putParams.ObjectLockRetainUntilDate = retainUntil;
    }
    
    // Upload to S3
    const result = await this.s3.putObject(putParams);
    
    const anchorRef = `s3://${this.config.bucket}/${key}`;
    
    return {
      anchorRef,
      anchorType: 'WORM',
      anchorPayload: payload,
      etag: result.ETag,
      versionId: result.VersionId,
    };
  }
  
  /**
   * Verify an anchor exists and matches expected values.
   */
  async verify(
    anchorRef: string,
    expectedRootHash: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    payload?: AnchorPayload;
  }> {
    const errors: string[] = [];
    
    // Parse anchor ref
    const match = anchorRef.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      return { valid: false, errors: ['INVALID_ANCHOR_REF_FORMAT'] };
    }
    
    const [, bucket, key] = match;
    
    try {
      // Get anchor object
      const result = await this.s3.getObject({ Bucket: bucket, Key: key });
      const payload: AnchorPayload = JSON.parse(result.Body.toString('utf-8'));
      
      // Verify root hash matches
      if (payload.root_hash !== expectedRootHash) {
        errors.push('ROOT_HASH_MISMATCH');
      }
      
      // Verify anchor hash integrity
      const { anchor_hash, ...payloadWithoutHash } = payload;
      const expectedAnchorHash = this.computeAnchorHash(payloadWithoutHash);
      
      if (anchor_hash !== expectedAnchorHash) {
        errors.push('ANCHOR_HASH_MISMATCH');
      }
      
      // Check Object Lock status
      const headResult = await this.s3.headObject({ Bucket: bucket, Key: key });
      
      if (this.config.objectLockEnabled && headResult.ObjectLockMode !== 'COMPLIANCE') {
        errors.push('OBJECT_LOCK_NOT_COMPLIANCE');
      }
      
      return {
        valid: errors.length === 0,
        errors,
        payload,
      };
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.code === 'NoSuchKey') {
        return { valid: false, errors: ['ANCHOR_NOT_FOUND'] };
      }
      return { valid: false, errors: [`ANCHOR_FETCH_ERROR:${err.message}`] };
    }
  }
  
  /**
   * Build S3 key for anchor object.
   */
  private buildKey(tenantId: string, environmentId: string, batchId: string): string {
    // Structure: prefix/tenant/env/YYYY/MM/DD/batch_id.json
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    
    return `${this.config.prefix}/${tenantId}/${environmentId}/${year}/${month}/${day}/${batchId}.json`;
  }
  
  /**
   * Compute anchor hash for integrity verification.
   */
  private computeAnchorHash(payload: Omit<AnchorPayload, 'anchor_hash'>): string {
    // Canonical JSON serialization
    const keys = Object.keys(payload).sort();
    const canonical = keys.map(k => `${k}:${JSON.stringify((payload as any)[k])}`).join('|');
    
    return createHash('sha256').update(canonical).digest('hex');
  }
}

// ============================================================
// MOCK S3 CLIENT (FOR TESTING)
// ============================================================

export class MockS3Client implements S3ClientInterface {
  private storage: Map<string, {
    body: Buffer;
    etag: string;
    versionId: string;
    metadata?: Record<string, string>;
    objectLockMode?: string;
    objectLockRetainUntilDate?: Date;
  }> = new Map();
  
  async putObject(params: Parameters<S3ClientInterface['putObject']>[0]) {
    const key = `${params.Bucket}/${params.Key}`;
    const body = typeof params.Body === 'string' ? Buffer.from(params.Body) : params.Body;
    const etag = `"${createHash('md5').update(body).digest('hex')}"`;
    const versionId = `v${Date.now()}`;
    
    this.storage.set(key, {
      body,
      etag,
      versionId,
      metadata: params.Metadata,
      objectLockMode: params.ObjectLockMode,
      objectLockRetainUntilDate: params.ObjectLockRetainUntilDate,
    });
    
    return { ETag: etag, VersionId: versionId };
  }
  
  async getObject(params: Parameters<S3ClientInterface['getObject']>[0]) {
    const key = `${params.Bucket}/${params.Key}`;
    const obj = this.storage.get(key);
    
    if (!obj) {
      const err = new Error('NoSuchKey');
      (err as any).name = 'NoSuchKey';
      throw err;
    }
    
    return {
      Body: obj.body,
      ETag: obj.etag,
      VersionId: obj.versionId,
      Metadata: obj.metadata,
    };
  }
  
  async headObject(params: Parameters<S3ClientInterface['headObject']>[0]) {
    const key = `${params.Bucket}/${params.Key}`;
    const obj = this.storage.get(key);
    
    if (!obj) {
      const err = new Error('NoSuchKey');
      (err as any).name = 'NoSuchKey';
      throw err;
    }
    
    return {
      ETag: obj.etag,
      VersionId: obj.versionId,
      ObjectLockMode: obj.objectLockMode,
      ObjectLockRetainUntilDate: obj.objectLockRetainUntilDate,
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

export function createS3AnchorService(
  config: S3AnchorConfig,
  s3Client: S3ClientInterface
): S3AnchorService {
  return new S3AnchorService(config, s3Client);
}
