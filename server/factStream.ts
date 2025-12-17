/**
 * Fact Stream - Server-Sent Events for real-time fact updates
 * 
 * CRITICAL PRINCIPLE:
 * - Stream new fact IDs only (not computed state)
 * - UI must re-query, replay, re-render on new facts
 * - Keep replay sacred - no client-side state computation
 * 
 * Events emitted:
 * - payment_fact: { paymentId, factId, factType, sequence }
 * - deposit_fact: { accountId, factId, factType, sequence }
 * - safeguard_change: { type, scheme, newState }
 */

import { EventEmitter } from "events";
import type { Response } from "express";
import { writePaymentEvent, writeDepositEvent, type EventWriteResult } from './services/GovernedEventService';

// Global event emitter for fact notifications
export const factEventEmitter = new EventEmitter();
factEventEmitter.setMaxListeners(100); // Support many concurrent SSE connections

// Types for fact events
export interface PaymentFactEvent {
  type: "payment_fact";
  paymentId: string;
  factId: string;
  factType: string;
  sequence: number;
  occurredAt: string;
}

export interface DepositFactEvent {
  type: "deposit_fact";
  accountId: string;
  factId: string;
  factType: string;
  sequence: number;
  occurredAt: string;
}

export interface SafeguardChangeEvent {
  type: "safeguard_change";
  safeguardType: "kill_switch" | "circuit_breaker";
  scheme: string;
  newState: string;
  reason?: string;
  actor?: string;
}

export type FactStreamEvent = PaymentFactEvent | DepositFactEvent | SafeguardChangeEvent;

// Track last event ID for reconnection
let lastEventId = 0;
const recentEvents: Array<{ id: number; event: FactStreamEvent; timestamp: number }> = [];
const MAX_RECENT_EVENTS = 1000;

/**
 * Emit a new fact event to all connected clients
 */
export function emitFactEvent(event: FactStreamEvent): number {
  lastEventId++;
  const eventWithId = { id: lastEventId, event, timestamp: Date.now() };
  
  // Store in recent events buffer for reconnection
  recentEvents.push(eventWithId);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
  
  // Broadcast to all listeners
  factEventEmitter.emit("fact", eventWithId);
  
  return lastEventId;
}

/**
 * Get events since a given ID (for reconnection)
 */
export function getEventsSince(sinceId: number): Array<{ id: number; event: FactStreamEvent }> {
  return recentEvents
    .filter(e => e.id > sinceId)
    .map(({ id, event }) => ({ id, event }));
}

/**
 * SSE handler for Express
 */
export function handleFactStream(res: Response, lastEventIdHeader?: string): () => void {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  
  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ lastEventId })}\n\n`);
  
  // If client sent Last-Event-ID, replay missed events
  if (lastEventIdHeader) {
    const sinceId = parseInt(lastEventIdHeader, 10);
    if (!isNaN(sinceId)) {
      const missedEvents = getEventsSince(sinceId);
      for (const { id, event } of missedEvents) {
        res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }
  }
  
  // Listen for new events
  const onFact = (eventWithId: { id: number; event: FactStreamEvent }) => {
    const { id, event } = eventWithId;
    res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  
  factEventEmitter.on("fact", onFact);
  
  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);
  
  // Cleanup function
  return () => {
    factEventEmitter.off("fact", onFact);
    clearInterval(heartbeat);
  };
}

/**
 * Helper to emit payment fact from router
 */
export function emitPaymentFact(
  paymentId: string,
  factId: string,
  factType: string,
  sequence: number
): number {
  return emitFactEvent({
    type: "payment_fact",
    paymentId,
    factId,
    factType,
    sequence,
    occurredAt: new Date().toISOString(),
  });
}

/**
 * GOVERNED: Emit payment fact with hash computation for Merkle sealing.
 * Use this instead of emitPaymentFact for new code.
 */
export async function emitGovernedPaymentFact(
  paymentId: string,
  factType: string,
  factData: Record<string, unknown>,
  sequence: number,
  decisionContext?: {
    decisionId: string;
    policyId: string;
    policyVersion: string;
    outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  }
): Promise<{ eventId: number; writeResult: EventWriteResult }> {
  // Write to governed event store with hash computation
  const writeResult = await writePaymentEvent(
    paymentId,
    factType,
    { ...factData, sequence },
    decisionContext
  );
  
  // Emit SSE notification
  const eventId = emitFactEvent({
    type: "payment_fact",
    paymentId,
    factId: writeResult.eventId,
    factType,
    sequence,
    occurredAt: new Date().toISOString(),
  });
  
  console.log(`[GovernedFact] Payment ${paymentId} ${factType} → leafHash: ${writeResult.leafHash.slice(0, 16)}...`);
  
  return { eventId, writeResult };
}

/**
 * Helper to emit deposit fact from router
 */
export function emitDepositFact(
  accountId: string,
  factId: string,
  factType: string,
  sequence: number
): number {
  return emitFactEvent({
    type: "deposit_fact",
    accountId,
    factId,
    factType,
    sequence,
    occurredAt: new Date().toISOString(),
  });
}

/**
 * GOVERNED: Emit deposit fact with hash computation for Merkle sealing.
 * Use this instead of emitDepositFact for new code.
 */
export async function emitGovernedDepositFact(
  accountId: string,
  factType: string,
  factData: Record<string, unknown>,
  sequence: number,
  decisionContext?: {
    decisionId: string;
    policyId: string;
    policyVersion: string;
    outcome: 'ALLOW' | 'REVIEW' | 'DECLINE';
  }
): Promise<{ eventId: number; writeResult: EventWriteResult }> {
  // Write to governed event store with hash computation
  const writeResult = await writeDepositEvent(
    accountId,
    factType,
    { ...factData, sequence },
    decisionContext
  );
  
  // Emit SSE notification
  const eventId = emitFactEvent({
    type: "deposit_fact",
    accountId,
    factId: writeResult.eventId,
    factType,
    sequence,
    occurredAt: new Date().toISOString(),
  });
  
  console.log(`[GovernedFact] Deposit ${accountId} ${factType} → leafHash: ${writeResult.leafHash.slice(0, 16)}...`);
  
  return { eventId, writeResult };
}

/**
 * Helper to emit safeguard change
 */
export function emitSafeguardChange(
  safeguardType: "kill_switch" | "circuit_breaker",
  scheme: string,
  newState: string,
  reason?: string,
  actor?: string
): number {
  return emitFactEvent({
    type: "safeguard_change",
    safeguardType,
    scheme,
    newState,
    reason,
    actor,
  });
}
