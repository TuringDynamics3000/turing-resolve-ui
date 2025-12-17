/**
 * Payment Rail Adapter for Event Store Integration
 * 
 * Provides a bridge between payment rail implementations and the event store.
 * Handles event serialization, deserialization, and replay for each rail.
 */

import { EventStoreRepository, PaymentEvent } from './EventStoreRepository';
import { createCardsPayment, applyCardsEvent, rebuildCardsFromEvents } from '../../core/payments/cards';

/**
 * Generic payment rail adapter
 */
export interface PaymentRailAdapter<TPayment, TEvent> {
  rail: 'NPP' | 'BECS' | 'RTGS' | 'CARDS';
  
  // Convert domain event to storage event
  toStorageEvent(domainEvent: TEvent, payment: TPayment): PaymentEvent;
  
  // Convert storage event to domain event
  fromStorageEvent(storageEvent: PaymentEvent): TEvent;
  
  // Rebuild payment from events
  rebuild(events: TEvent[]): TPayment;
}

// NPP and BECS adapters removed - will be reimplemented in future release

/**
 * Cards Rail Adapter
 */
export class CardsRailAdapter implements PaymentRailAdapter<any, any> {
  rail: 'CARDS' = 'CARDS';

  toStorageEvent(domainEvent: any, payment: any): PaymentEvent {
    return {
      eventId: crypto.randomUUID(),
      eventType: domainEvent.type,
      paymentId: payment.paymentId,
      rail: 'CARDS',
      eventData: domainEvent,
      metadata: {
        state: payment.state,
        authAmount: payment.authAmount,
        capturedAmount: payment.capturedAmount,
      },
      occurredAt: domainEvent.timestamp || new Date(),
      sequenceNumber: payment.version || 0,
      idempotencyKey: `${payment.paymentIntentId}-${domainEvent.type}-${Date.now()}`,
    };
  }

  fromStorageEvent(storageEvent: PaymentEvent): any {
    return storageEvent.eventData;
  }

  rebuild(events: any[]): any {
    return rebuildCardsFromEvents(events);
  }
}

/**
 * Payment Service with Event Store Integration
 * 
 * Provides high-level operations for payment management with automatic persistence.
 */
export class PaymentService {
  constructor(
    private eventStore: EventStoreRepository,
    private adapters: Map<string, PaymentRailAdapter<any, any>>
  ) {}

  /**
   * Create a new payment and persist initial event
   */
  async createPayment(rail: 'CARDS', initialEvent: any): Promise<any> {
    const adapter = this.adapters.get(rail);
    if (!adapter) {
      throw new Error(`No adapter found for rail: ${rail}`);
    }

    // Create payment in memory (only Cards supported currently)
    const payment = createCardsPayment(initialEvent);

    // Convert to storage event and persist
    const storageEvent = adapter.toStorageEvent(initialEvent, payment);
    await this.eventStore.saveEvent(storageEvent);

    return payment;
  }

  /**
   * Apply an event to a payment and persist
   */
  async applyEvent(paymentId: string, rail: 'CARDS', event: any): Promise<any> {
    const adapter = this.adapters.get(rail);
    if (!adapter) {
      throw new Error(`No adapter found for rail: ${rail}`);
    }

    // Load current payment state
    const payment = await this.loadPayment(paymentId, rail);

    // Apply event in memory (only Cards supported currently)
    const updatedPayment = applyCardsEvent(payment, event);

    // Convert to storage event and persist
    const storageEvent = adapter.toStorageEvent(event, updatedPayment);
    await this.eventStore.saveEvent(storageEvent);

    return updatedPayment;
  }

  /**
   * Load a payment by replaying all events from the event store
   */
  async loadPayment(paymentId: string, rail: 'CARDS'): Promise<any> {
    const adapter = this.adapters.get(rail);
    if (!adapter) {
      throw new Error(`No adapter found for rail: ${rail}`);
    }

    // Load events from event store
    const storageEvents = await this.eventStore.loadEvents(paymentId);
    
    if (storageEvents.length === 0) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // Convert to domain events
    const domainEvents = storageEvents.map(e => adapter.fromStorageEvent(e));

    // Rebuild payment state
    return adapter.rebuild(domainEvents);
  }

  /**
   * Get event count for a payment
   */
  async getEventCount(paymentId: string): Promise<number> {
    return this.eventStore.getEventCount(paymentId);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.eventStore.healthCheck();
  }
}

/**
 * Factory function to create a PaymentService with all rail adapters
 */
export function createPaymentService(eventStore: EventStoreRepository): PaymentService {
  const adapters = new Map<string, PaymentRailAdapter<any, any>>();
  adapters.set('CARDS', new CardsRailAdapter());
  // NPP and BECS will be added in future release

  return new PaymentService(eventStore, adapters);
}
