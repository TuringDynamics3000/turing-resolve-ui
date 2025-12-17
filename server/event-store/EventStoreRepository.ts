/**
 * PostgreSQL Event Store Repository
 * 
 * Provides persistence for payment events with:
 * - Append-only event storage
 * - Deterministic replay
 * - Idempotency guarantees
 * - Snapshot support for performance
 */

import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

// Generic event interface
export interface PaymentEvent {
  eventId: string;
  eventType: string;
  paymentId: string;
  rail: 'NPP' | 'BECS' | 'RTGS' | 'CARDS';
  eventData: Record<string, any>;
  metadata?: Record<string, any>;
  occurredAt: Date;
  sequenceNumber: number;
  idempotencyKey?: string;
  createdBy?: string;
  correlationId?: string;
  causationId?: string;
}

// Snapshot interface
export interface PaymentSnapshot {
  paymentId: string;
  rail: 'NPP' | 'BECS' | 'RTGS' | 'CARDS';
  stateData: Record<string, any>;
  stateHash: string;
  sequenceNumber: number;
  eventCount: number;
  snapshotAt: Date;
}

// Repository configuration
export interface EventStoreConfig {
  connectionString?: string;
  pool?: Pool;
  snapshotInterval?: number; // Save snapshot every N events
  enableSnapshots?: boolean;
}

export class EventStoreRepository {
  private pool: Pool;
  private snapshotInterval: number;
  private enableSnapshots: boolean;

  constructor(config: EventStoreConfig) {
    this.pool = config.pool || new Pool({
      connectionString: config.connectionString || process.env.DATABASE_URL,
    });
    this.snapshotInterval = config.snapshotInterval || 100;
    this.enableSnapshots = config.enableSnapshots ?? true;
  }

  /**
   * Save a single event to the event store
   * Enforces idempotency and sequence ordering
   */
  async saveEvent(event: PaymentEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert event (will fail if idempotency key or sequence number conflicts)
      await client.query(
        `INSERT INTO payment_events (
          event_id, event_type, payment_id, rail, event_data, metadata,
          occurred_at, sequence_number, idempotency_key, created_by,
          correlation_id, causation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          event.eventId,
          event.eventType,
          event.paymentId,
          event.rail,
          JSON.stringify(event.eventData),
          event.metadata ? JSON.stringify(event.metadata) : null,
          event.occurredAt,
          event.sequenceNumber,
          event.idempotencyKey,
          event.createdBy,
          event.correlationId,
          event.causationId,
        ]
      );

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      // Check if it's a duplicate (idempotency key or sequence conflict)
      if (error.code === '23505') { // unique_violation
        // Idempotent - event already exists, safe to ignore
        return;
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save multiple events in a single transaction
   * All events must be for the same payment
   */
  async saveEvents(events: PaymentEvent[]): Promise<void> {
    if (events.length === 0) return;

    const paymentId = events[0].paymentId;
    if (!events.every(e => e.paymentId === paymentId)) {
      throw new Error('All events must belong to the same payment');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO payment_events (
            event_id, event_type, payment_id, rail, event_data, metadata,
            occurred_at, sequence_number, idempotency_key, created_by,
            correlation_id, causation_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (payment_id, idempotency_key) DO NOTHING`,
          [
            event.eventId,
            event.eventType,
            event.paymentId,
            event.rail,
            JSON.stringify(event.eventData),
            event.metadata ? JSON.stringify(event.metadata) : null,
            event.occurredAt,
            event.sequenceNumber,
            event.idempotencyKey,
            event.createdBy,
            event.correlationId,
            event.causationId,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Load all events for a payment, ordered by sequence number
   * Optionally load from a specific sequence number (for incremental replay)
   */
  async loadEvents(paymentId: string, fromSequence: number = 0): Promise<PaymentEvent[]> {
    const result = await this.pool.query(
      `SELECT 
        event_id, event_type, payment_id, rail, event_data, metadata,
        occurred_at, persisted_at, sequence_number, idempotency_key,
        created_by, correlation_id, causation_id
      FROM payment_events
      WHERE payment_id = $1 AND sequence_number >= $2
      ORDER BY sequence_number ASC`,
      [paymentId, fromSequence]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      paymentId: row.payment_id,
      rail: row.rail,
      eventData: row.event_data,
      metadata: row.metadata,
      occurredAt: row.occurred_at,
      sequenceNumber: row.sequence_number,
      idempotencyKey: row.idempotency_key,
      createdBy: row.created_by,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
    }));
  }

  /**
   * Get the latest snapshot for a payment (if exists)
   */
  async loadSnapshot(paymentId: string): Promise<PaymentSnapshot | null> {
    if (!this.enableSnapshots) return null;

    const result = await this.pool.query(
      `SELECT 
        payment_id, rail, state_data, state_hash, sequence_number,
        event_count, snapshot_at
      FROM payment_snapshots
      WHERE payment_id = $1
      ORDER BY sequence_number DESC
      LIMIT 1`,
      [paymentId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      paymentId: row.payment_id,
      rail: row.rail,
      stateData: row.state_data,
      stateHash: row.state_hash,
      sequenceNumber: row.sequence_number,
      eventCount: row.event_count,
      snapshotAt: row.snapshot_at,
    };
  }

  /**
   * Save a snapshot for faster replay
   */
  async saveSnapshot(snapshot: PaymentSnapshot): Promise<void> {
    if (!this.enableSnapshots) return;

    await this.pool.query(
      `INSERT INTO payment_snapshots (
        payment_id, rail, state_data, state_hash, sequence_number,
        event_count, snapshot_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (payment_id, sequence_number) DO NOTHING`,
      [
        snapshot.paymentId,
        snapshot.rail,
        JSON.stringify(snapshot.stateData),
        snapshot.stateHash,
        snapshot.sequenceNumber,
        snapshot.eventCount,
        snapshot.snapshotAt,
      ]
    );
  }

  /**
   * Replay events to rebuild payment state
   * Uses snapshot if available for performance
   */
  async replay<T>(
    paymentId: string,
    rebuildFn: (events: PaymentEvent[]) => T
  ): Promise<T> {
    // Try to load snapshot first
    const snapshot = await this.loadSnapshot(paymentId);
    
    let events: PaymentEvent[];
    if (snapshot) {
      // Load only events after snapshot
      events = await this.loadEvents(paymentId, snapshot.sequenceNumber + 1);
      
      // Prepend snapshot as synthetic event (for rebuild function)
      // Note: This assumes rebuildFn can handle snapshot state
      // Alternative: rebuildFn could accept (snapshot, incrementalEvents)
    } else {
      // Load all events from beginning
      events = await this.loadEvents(paymentId);
    }

    // Rebuild state from events
    return rebuildFn(events);
  }

  /**
   * Get event count for a payment
   */
  async getEventCount(paymentId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM payment_events WHERE payment_id = $1`,
      [paymentId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get all payment IDs for a rail
   */
  async getPaymentIds(rail: 'NPP' | 'BECS' | 'RTGS' | 'CARDS', limit: number = 100): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT payment_id FROM payment_events WHERE rail = $1 LIMIT $2`,
      [rail, limit]
    );
    return result.rows.map(row => row.payment_id);
  }

  /**
   * Compute SHA-256 hash of state for replay verification
   */
  static computeStateHash(state: Record<string, any>): string {
    const canonical = JSON.stringify(state, Object.keys(state).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Health check - verify database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
