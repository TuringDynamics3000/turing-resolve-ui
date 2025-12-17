/**
 * Event Hashing Utility
 * 
 * Wires computeEventDigest() to the actual event write path.
 * All events MUST be hashed before insertion into the event store.
 * 
 * INVARIANT: Hashes are computed in the same transaction as the insert.
 * INVARIANT: Hash computation is deterministic (canonical JSON, no floats).
 */

import * as crypto from 'crypto';

// ============================================================
// CANONICAL JSON
// ============================================================

/**
 * Canonicalize an object for deterministic JSON serialization.
 * - Keys sorted alphabetically
 * - No whitespace
 * - Floats are FORBIDDEN
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      throw new Error(`Floats not allowed in canonical JSON: ${value}. Use string decimals.`);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort object keys
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
}

// ============================================================
// HASH FUNCTIONS
// ============================================================

/**
 * Compute SHA-256 hash of data.
 */
export function sha256(data: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Compute SHA-256 hash and return as hex string.
 */
export function sha256Hex(data: string | Buffer): string {
  return sha256(data).toString('hex');
}

// ============================================================
// DOMAIN SEPARATION PREFIXES
// ============================================================

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

// ============================================================
// EVENT HASHING
// ============================================================

export interface EventMetadata {
  eventId: string;
  tenantId: string;
  environmentId: string;
  streamId: string;
  streamType: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId?: string;
  causationId?: string;
  actorId?: string;
  [key: string]: unknown;
}

export interface EventHashResult {
  payloadHash: string;    // SHA-256 of canonical payload JSON
  metaHash: string;       // SHA-256 of canonical metadata JSON
  eventDigest: string;    // SHA-256(eventId || payloadHash || metaHash || occurredAt)
  leafHash: string;       // SHA-256(0x00 || eventDigest) - Merkle leaf
}

/**
 * Compute all hashes for an event.
 * 
 * This function MUST be called before inserting an event into the store.
 * The hashes are stored alongside the event for Merkle audit trail.
 * 
 * @param eventId - Unique event identifier
 * @param payload - Event payload (will be canonicalized)
 * @param metadata - Event metadata (will be canonicalized)
 * @param occurredAt - Event timestamp
 * @returns Hash result with all computed hashes
 */
export function computeEventHashes(
  eventId: string,
  payload: Record<string, unknown>,
  metadata: EventMetadata,
  occurredAt: Date,
): EventHashResult {
  // 1. Compute payload hash
  const payloadJson = canonicalJson(payload);
  const payloadHash = sha256Hex(payloadJson);
  
  // 2. Compute metadata hash
  const metaJson = canonicalJson(metadata);
  const metaHash = sha256Hex(metaJson);
  
  // 3. Compute event digest
  // eventDigest = SHA256(eventId || payloadHash || metaHash || occurredAt_iso)
  const digestInput = `${eventId}${payloadHash}${metaHash}${occurredAt.toISOString()}`;
  const eventDigest = sha256Hex(digestInput);
  
  // 4. Compute leaf hash with domain separation
  // leafHash = SHA256(0x00 || eventDigest)
  const leafInput = Buffer.concat([LEAF_PREFIX, Buffer.from(eventDigest, 'hex')]);
  const leafHash = sha256Hex(leafInput);
  
  return {
    payloadHash,
    metaHash,
    eventDigest,
    leafHash,
  };
}

// ============================================================
// EVENT STORE INTEGRATION
// ============================================================

export interface HashedEvent {
  eventId: string;
  tenantId: string;
  environmentId: string;
  streamId: string;
  streamType: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  occurredAt: Date;
  recordedAt: Date;
  // Computed hashes
  payloadHash: string;
  metaHash: string;
  eventDigest: string;
  leafHash: string;
}

/**
 * Prepare an event for insertion with all hashes computed.
 * 
 * Usage:
 *   const hashedEvent = prepareEventForInsert(eventData);
 *   await db.insert(events).values(hashedEvent);
 */
export function prepareEventForInsert(
  event: Omit<HashedEvent, 'payloadHash' | 'metaHash' | 'eventDigest' | 'leafHash' | 'recordedAt'>,
): HashedEvent {
  const metadata: EventMetadata = {
    eventId: event.eventId,
    tenantId: event.tenantId,
    environmentId: event.environmentId,
    streamId: event.streamId,
    streamType: event.streamType,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    ...event.metadata,
  };
  
  const hashes = computeEventHashes(
    event.eventId,
    event.payload,
    metadata,
    event.occurredAt,
  );
  
  return {
    ...event,
    recordedAt: new Date(),
    payloadHash: hashes.payloadHash,
    metaHash: hashes.metaHash,
    eventDigest: hashes.eventDigest,
    leafHash: hashes.leafHash,
  };
}

// ============================================================
// VERIFICATION
// ============================================================

/**
 * Verify that stored hashes match recomputed hashes.
 * 
 * Use this to verify event integrity during replay or audit.
 */
export function verifyEventHashes(event: HashedEvent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  const metadata: EventMetadata = {
    eventId: event.eventId,
    tenantId: event.tenantId,
    environmentId: event.environmentId,
    streamId: event.streamId,
    streamType: event.streamType,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    ...event.metadata,
  };
  
  const recomputed = computeEventHashes(
    event.eventId,
    event.payload,
    metadata,
    event.occurredAt,
  );
  
  if (recomputed.payloadHash !== event.payloadHash) {
    errors.push(`Payload hash mismatch: expected ${event.payloadHash}, got ${recomputed.payloadHash}`);
  }
  
  if (recomputed.metaHash !== event.metaHash) {
    errors.push(`Meta hash mismatch: expected ${event.metaHash}, got ${recomputed.metaHash}`);
  }
  
  if (recomputed.eventDigest !== event.eventDigest) {
    errors.push(`Event digest mismatch: expected ${event.eventDigest}, got ${recomputed.eventDigest}`);
  }
  
  if (recomputed.leafHash !== event.leafHash) {
    errors.push(`Leaf hash mismatch: expected ${event.leafHash}, got ${recomputed.leafHash}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Compute leaf hashes for a batch of events.
 * 
 * Use this when sealing a Merkle batch.
 */
export function computeBatchLeafHashes(events: HashedEvent[]): string[] {
  return events.map(e => e.leafHash);
}

/**
 * Verify all events in a batch have valid hashes.
 */
export function verifyBatchHashes(events: HashedEvent[]): {
  valid: boolean;
  invalidEvents: Array<{ eventId: string; errors: string[] }>;
} {
  const invalidEvents: Array<{ eventId: string; errors: string[] }> = [];
  
  for (const event of events) {
    const result = verifyEventHashes(event);
    if (!result.valid) {
      invalidEvents.push({
        eventId: event.eventId,
        errors: result.errors,
      });
    }
  }
  
  return {
    valid: invalidEvents.length === 0,
    invalidEvents,
  };
}
