/**
 * Payment WebSocket Service
 * 
 * Provides real-time payment status updates via WebSocket connections.
 * Supports both server-sent events and client subscriptions.
 */

import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export type PaymentEventType = 
  | "PAYMENT_INITIATED"
  | "PAYMENT_VALIDATED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_ACCEPTED"
  | "PAYMENT_REJECTED"
  | "PAYMENT_SETTLED"
  | "PAYMENT_FAILED"
  | "PAYMENT_RETURNED"
  | "BATCH_CREATED"
  | "BATCH_SUBMITTED"
  | "BATCH_PROCESSING"
  | "BATCH_SETTLED"
  | "BATCH_FAILED";

export interface PaymentEvent {
  eventId: string;
  eventType: PaymentEventType;
  timestamp: string;
  paymentId?: string;
  batchId?: string;
  data: {
    status?: string;
    previousStatus?: string;
    amount?: number;
    currency?: string;
    creditorName?: string;
    reference?: string;
    schemeReference?: string;
    errorCode?: string;
    errorMessage?: string;
    [key: string]: unknown;
  };
}

export interface WebSocketClient {
  clientId: string;
  userId?: string;
  subscriptions: Set<string>; // paymentId or batchId or "*" for all
  connectedAt: string;
  lastPingAt: string;
}

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "ping" | "pong" | "event";
  payload?: unknown;
}

// ============================================
// EVENT EMITTER
// ============================================

type EventHandler = (event: PaymentEvent) => void;

class PaymentEventEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  /**
   * Subscribe to events for a specific payment or batch.
   */
  subscribe(id: string, handler: EventHandler): () => void {
    if (!this.handlers.has(id)) {
      this.handlers.set(id, new Set());
    }
    this.handlers.get(id)!.add(handler);
    
    return () => {
      this.handlers.get(id)?.delete(handler);
    };
  }

  /**
   * Subscribe to all events.
   */
  subscribeAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Emit an event.
   */
  emit(event: PaymentEvent): void {
    // Notify specific subscribers
    const id = event.paymentId || event.batchId;
    if (id && this.handlers.has(id)) {
      this.handlers.get(id)!.forEach(handler => handler(event));
    }
    
    // Notify global subscribers
    this.globalHandlers.forEach(handler => handler(event));
  }
}

// ============================================
// WEBSOCKET SERVICE
// ============================================

class PaymentWebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private eventEmitter = new PaymentEventEmitter();
  private eventHistory: PaymentEvent[] = [];
  private maxHistorySize = 1000;

  /**
   * Register a new WebSocket client.
   */
  registerClient(userId?: string): WebSocketClient {
    const client: WebSocketClient = {
      clientId: nanoid(),
      userId,
      subscriptions: new Set(),
      connectedAt: new Date().toISOString(),
      lastPingAt: new Date().toISOString(),
    };
    
    this.clients.set(client.clientId, client);
    return client;
  }

  /**
   * Unregister a WebSocket client.
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Subscribe a client to payment/batch updates.
   */
  subscribe(clientId: string, id: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    client.subscriptions.add(id);
    return true;
  }

  /**
   * Unsubscribe a client from payment/batch updates.
   */
  unsubscribe(clientId: string, id: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    client.subscriptions.delete(id);
    return true;
  }

  /**
   * Emit a payment event.
   */
  emitEvent(
    eventType: PaymentEventType,
    paymentId: string | undefined,
    batchId: string | undefined,
    data: PaymentEvent["data"]
  ): PaymentEvent {
    const event: PaymentEvent = {
      eventId: nanoid(),
      eventType,
      timestamp: new Date().toISOString(),
      paymentId,
      batchId,
      data,
    };
    
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Emit to subscribers
    this.eventEmitter.emit(event);
    
    return event;
  }

  /**
   * Get events to send to a specific client.
   */
  getEventsForClient(clientId: string, since?: string): PaymentEvent[] {
    const client = this.clients.get(clientId);
    if (!client) return [];
    
    const sinceTime = since ? new Date(since).getTime() : 0;
    
    return this.eventHistory.filter(event => {
      // Check time filter
      if (new Date(event.timestamp).getTime() <= sinceTime) return false;
      
      // Check subscription filter
      if (client.subscriptions.has("*")) return true;
      if (event.paymentId && client.subscriptions.has(event.paymentId)) return true;
      if (event.batchId && client.subscriptions.has(event.batchId)) return true;
      
      return false;
    });
  }

  /**
   * Subscribe to events programmatically.
   */
  onEvent(id: string, handler: (event: PaymentEvent) => void): () => void {
    return this.eventEmitter.subscribe(id, handler);
  }

  /**
   * Subscribe to all events programmatically.
   */
  onAllEvents(handler: (event: PaymentEvent) => void): () => void {
    return this.eventEmitter.subscribeAll(handler);
  }

  /**
   * Get recent events for a payment or batch.
   */
  getEventHistory(id: string, limit: number = 50): PaymentEvent[] {
    return this.eventHistory
      .filter(e => e.paymentId === id || e.batchId === id)
      .slice(-limit);
  }

  /**
   * Get all connected clients.
   */
  getConnectedClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client count.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Update client ping time.
   */
  updatePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPingAt = new Date().toISOString();
    }
  }

  /**
   * Clean up stale clients (no ping in 60 seconds).
   */
  cleanupStaleClients(): number {
    const staleThreshold = Date.now() - 60000;
    let removed = 0;
    
    for (const [clientId, client] of this.clients) {
      if (new Date(client.lastPingAt).getTime() < staleThreshold) {
        this.clients.delete(clientId);
        removed++;
      }
    }
    
    return removed;
  }

  // ============================================
  // CONVENIENCE METHODS FOR PAYMENT EVENTS
  // ============================================

  paymentInitiated(paymentId: string, amount: number, creditorName: string, reference: string): PaymentEvent {
    return this.emitEvent("PAYMENT_INITIATED", paymentId, undefined, {
      status: "INITIATED",
      amount,
      currency: "AUD",
      creditorName,
      reference,
    });
  }

  paymentValidated(paymentId: string): PaymentEvent {
    return this.emitEvent("PAYMENT_VALIDATED", paymentId, undefined, {
      status: "VALIDATED",
      previousStatus: "INITIATED",
    });
  }

  paymentAuthorized(paymentId: string): PaymentEvent {
    return this.emitEvent("PAYMENT_AUTHORIZED", paymentId, undefined, {
      status: "AUTHORIZED",
      previousStatus: "VALIDATED",
    });
  }

  paymentSubmitted(paymentId: string, schemeReference: string): PaymentEvent {
    return this.emitEvent("PAYMENT_SUBMITTED", paymentId, undefined, {
      status: "SUBMITTED",
      previousStatus: "AUTHORIZED",
      schemeReference,
    });
  }

  paymentSettled(paymentId: string, schemeReference: string): PaymentEvent {
    return this.emitEvent("PAYMENT_SETTLED", paymentId, undefined, {
      status: "SETTLED",
      previousStatus: "SUBMITTED",
      schemeReference,
    });
  }

  paymentFailed(paymentId: string, errorCode: string, errorMessage: string): PaymentEvent {
    return this.emitEvent("PAYMENT_FAILED", paymentId, undefined, {
      status: "FAILED",
      errorCode,
      errorMessage,
    });
  }

  batchCreated(batchId: string, transactionCount: number, totalAmount: number): PaymentEvent {
    return this.emitEvent("BATCH_CREATED", undefined, batchId, {
      status: "DRAFT",
      transactionCount,
      totalAmount,
    });
  }

  batchSubmitted(batchId: string, schemeReference: string): PaymentEvent {
    return this.emitEvent("BATCH_SUBMITTED", undefined, batchId, {
      status: "SUBMITTED",
      previousStatus: "DRAFT",
      schemeReference,
    });
  }

  batchSettled(batchId: string): PaymentEvent {
    return this.emitEvent("BATCH_SETTLED", undefined, batchId, {
      status: "SETTLED",
      previousStatus: "PROCESSING",
    });
  }
}

export const paymentWebSocket = new PaymentWebSocketService();
export default paymentWebSocket;
