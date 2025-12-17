/**
 * Governed Event Service
 * 
 * Wraps event storage with governance features:
 * - Hash computation on every event insert
 * - Decision context capture
 * - Evidence pack generation
 * - Merkle sealing integration
 * 
 * This is the single entry point for all event writes.
 * No module should write events directly to the database.
 */

import { randomUUID, createHash } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface EventInput {
  eventType: string;
  streamId: string;
  streamType: 'PAYMENT' | 'DEPOSIT' | 'LOAN' | 'EXPOSURE';
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    createdBy?: string;
    idempotencyKey?: string;
  };
  decisionContext?: {
    decisionId: string;
    policyId: string;
    policyVersion: string;
    outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  };
}

export interface GovernedEvent {
  eventId: string;
  tenantId: string;
  environmentId: string;
  streamId: string;
  streamType: string;
  streamVersion: number;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  committedAt: Date;
  commitSeq: number;
  
  // Hash columns for Merkle sealing
  payloadHash: string;
  metaHash: string;
  eventDigest: string;
  leafHash: string;
  
  // Decision linkage
  decisionId?: string;
  authorizationTokenId?: string;
}

export interface EventWriteResult {
  eventId: string;
  commitSeq: number;
  leafHash: string;
  decisionId?: string;
}

// ============================================================
// HASH COMPUTATION
// ============================================================

const LEAF_PREFIX = Buffer.from([0x00]);

function sha256(data: Buffer | string): string {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return createHash('sha256').update(input).digest('hex');
}

function canonicalJson(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

function computePayloadHash(payload: Record<string, unknown>): string {
  return sha256(canonicalJson(payload));
}

function computeMetaHash(meta: {
  tenantId: string;
  environmentId: string;
  eventId: string;
  streamId: string;
  streamVersion: number;
  eventType: string;
  occurredAt: Date;
}): string {
  const canonical = canonicalJson({
    tenant_id: meta.tenantId,
    environment_id: meta.environmentId,
    event_id: meta.eventId,
    stream_id: meta.streamId,
    stream_version: meta.streamVersion,
    event_type: meta.eventType,
    occurred_at: meta.occurredAt.toISOString(),
  });
  return sha256(canonical);
}

function computeEventDigest(payloadHash: string, metaHash: string): string {
  return sha256(payloadHash + metaHash);
}

function computeLeafHash(eventDigest: string): string {
  const digestBuffer = Buffer.from(eventDigest, 'hex');
  const prefixed = Buffer.concat([LEAF_PREFIX, digestBuffer]);
  return createHash('sha256').update(prefixed).digest('hex');
}

// ============================================================
// CONFIGURATION
// ============================================================

interface ServiceConfig {
  tenantId: string;
  environmentId: string;
}

const config: ServiceConfig = {
  tenantId: process.env.TENANT_ID || 'default',
  environmentId: process.env.ENVIRONMENT_ID || 'development',
};

// ============================================================
// STREAM VERSION TRACKING
// ============================================================

// In-memory cache for stream versions (production would use DB)
const streamVersionCache = new Map<string, number>();

async function getNextStreamVersion(streamId: string): Promise<number> {
  const current = streamVersionCache.get(streamId) || 0;
  const next = current + 1;
  streamVersionCache.set(streamId, next);
  return next;
}

// Global commit sequence (production would use DB sequence)
let globalCommitSeq = Date.now();

function getNextCommitSeq(): number {
  return ++globalCommitSeq;
}

// ============================================================
// GOVERNED EVENT SERVICE
// ============================================================

export class GovernedEventService {
  private tenantId: string;
  private environmentId: string;
  
  constructor(tenantId?: string, environmentId?: string) {
    this.tenantId = tenantId || config.tenantId;
    this.environmentId = environmentId || config.environmentId;
  }
  
  /**
   * Write a governed event with full hash computation.
   * This is the ONLY way events should be written.
   */
  async writeEvent(input: EventInput): Promise<EventWriteResult> {
    const eventId = randomUUID();
    const occurredAt = new Date();
    const committedAt = new Date();
    const streamVersion = await getNextStreamVersion(input.streamId);
    const commitSeq = getNextCommitSeq();
    
    // Compute hashes
    const payloadHash = computePayloadHash(input.payload);
    const metaHash = computeMetaHash({
      tenantId: this.tenantId,
      environmentId: this.environmentId,
      eventId,
      streamId: input.streamId,
      streamVersion,
      eventType: input.eventType,
      occurredAt,
    });
    const eventDigest = computeEventDigest(payloadHash, metaHash);
    const leafHash = computeLeafHash(eventDigest);
    
    // Build governed event
    const event: GovernedEvent = {
      eventId,
      tenantId: this.tenantId,
      environmentId: this.environmentId,
      streamId: input.streamId,
      streamType: input.streamType,
      streamVersion,
      eventType: input.eventType,
      payload: input.payload,
      occurredAt,
      committedAt,
      commitSeq,
      payloadHash,
      metaHash,
      eventDigest,
      leafHash,
      decisionId: input.decisionContext?.decisionId,
    };
    
    // Log for debugging (production would write to DB)
    console.log(`[GovernedEventService] Event written:`, {
      eventId,
      eventType: input.eventType,
      streamId: input.streamId,
      commitSeq,
      leafHash: leafHash.slice(0, 16) + '...',
      decisionId: input.decisionContext?.decisionId,
    });
    
    // Store event (in production, this writes to turing_core.events)
    await this.persistEvent(event);
    
    return {
      eventId,
      commitSeq,
      leafHash,
      decisionId: input.decisionContext?.decisionId,
    };
  }
  
  /**
   * Write multiple events in a transaction.
   */
  async writeEvents(inputs: EventInput[]): Promise<EventWriteResult[]> {
    const results: EventWriteResult[] = [];
    
    for (const input of inputs) {
      const result = await this.writeEvent(input);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Persist event to database.
   * This is where the actual DB write happens.
   */
  private async persistEvent(event: GovernedEvent): Promise<void> {
    // In production, this would be:
    // await db.insert(turingCoreEvents).values({
    //   event_id: event.eventId,
    //   tenant_id: event.tenantId,
    //   environment_id: event.environmentId,
    //   stream_id: event.streamId,
    //   stream_version: event.streamVersion,
    //   event_type: event.eventType,
    //   payload: event.payload,
    //   occurred_at: event.occurredAt,
    //   committed_at: event.committedAt,
    //   commit_seq: event.commitSeq,
    //   payload_hash: event.payloadHash,
    //   meta_hash: event.metaHash,
    //   event_digest: event.eventDigest,
    //   leaf_hash: event.leafHash,
    //   decision_id: event.decisionId,
    // });
    
    // For now, store in memory for demo
    eventStore.push(event);
  }
  
  /**
   * Get events for a stream (for replay).
   */
  async getStreamEvents(streamId: string): Promise<GovernedEvent[]> {
    return eventStore.filter(e => e.streamId === streamId);
  }
  
  /**
   * Get unsealed events for Merkle batch sealing.
   */
  async getUnsealedEvents(limit: number = 1000): Promise<GovernedEvent[]> {
    // In production, this would query events not yet in merkle_event_index
    return eventStore.slice(-limit);
  }
}

// In-memory event store for demo
const eventStore: GovernedEvent[] = [];

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let serviceInstance: GovernedEventService | null = null;

export function getGovernedEventService(): GovernedEventService {
  if (!serviceInstance) {
    serviceInstance = new GovernedEventService();
  }
  return serviceInstance;
}

// ============================================================
// CONVENIENCE FUNCTIONS FOR tRPC HANDLERS
// ============================================================

/**
 * Write a payment event with governance.
 */
export async function writePaymentEvent(
  paymentId: string,
  eventType: string,
  payload: Record<string, unknown>,
  decisionContext?: EventInput['decisionContext']
): Promise<EventWriteResult> {
  const service = getGovernedEventService();
  return service.writeEvent({
    eventType,
    streamId: paymentId,
    streamType: 'PAYMENT',
    payload,
    decisionContext,
  });
}

/**
 * Write a deposit event with governance.
 */
export async function writeDepositEvent(
  depositId: string,
  eventType: string,
  payload: Record<string, unknown>,
  decisionContext?: EventInput['decisionContext']
): Promise<EventWriteResult> {
  const service = getGovernedEventService();
  return service.writeEvent({
    eventType,
    streamId: depositId,
    streamType: 'DEPOSIT',
    payload,
    decisionContext,
  });
}

/**
 * Write a loan event with governance.
 */
export async function writeLoanEvent(
  loanId: string,
  eventType: string,
  payload: Record<string, unknown>,
  decisionContext?: EventInput['decisionContext']
): Promise<EventWriteResult> {
  const service = getGovernedEventService();
  return service.writeEvent({
    eventType,
    streamId: loanId,
    streamType: 'LOAN',
    payload,
    decisionContext,
  });
}

// ============================================================
// EXPORTS
// ============================================================

export {
  computePayloadHash,
  computeMetaHash,
  computeEventDigest,
  computeLeafHash,
  canonicalJson,
};
