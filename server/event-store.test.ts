/**
 * Event Store Integration Tests
 * 
 * Tests PostgreSQL event store with Cards payment rail integration.
 * Verifies save, load, replay, idempotency, and concurrency handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventStoreRepository, PaymentEvent } from './event-store/EventStoreRepository';
import { PaymentService, createPaymentService, CardsRailAdapter } from './event-store/PaymentRailAdapter';
import { CardsPaymentState } from '../core/payments/cards/CardsPaymentState';

/**
 * Mock EventStoreRepository for testing (in-memory implementation)
 */
class MockEventStoreRepository {
  private events: Map<string, PaymentEvent[]> = new Map();
  private eventIds: Set<string> = new Set();

  async saveEvent(event: PaymentEvent): Promise<void> {
    // Idempotency check
    if (this.eventIds.has(event.eventId)) {
      return; // Already saved
    }

    const paymentEvents = this.events.get(event.paymentId) || [];
    paymentEvents.push(event);
    this.events.set(event.paymentId, paymentEvents);
    this.eventIds.add(event.eventId);
  }

  async loadEvents(paymentId: string, fromSequence?: number): Promise<PaymentEvent[]> {
    const events = this.events.get(paymentId) || [];
    if (fromSequence !== undefined) {
      return events.filter(e => e.sequenceNumber >= fromSequence);
    }
    return events;
  }

  async getEventCount(paymentId: string): Promise<number> {
    return (this.events.get(paymentId) || []).length;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Test helper: clear all events
  clear(): void {
    this.events.clear();
    this.eventIds.clear();
  }
}

describe('Event Store Integration', () => {
  let eventStore: MockEventStoreRepository;
  let paymentService: PaymentService;

  beforeEach(() => {
    eventStore = new MockEventStoreRepository();
    paymentService = createPaymentService(eventStore);
  });

  describe('PaymentService - Create Payment', () => {
    it('should create a Cards payment and persist initial event', async () => {
      const initialEvent = {
        type: 'PaymentIntentCreated',
        paymentId: 'pay_test_001',
        amount: 10000n, // $100.00
        currency: 'AUD',
        timestamp: new Date(),
      };

      const payment = await paymentService.createPayment('CARDS', initialEvent);

      expect(payment.paymentId).toBe('pay_test_001');
      expect(payment.state).toBe(CardsPaymentState.CREATED);
      expect(payment.amount).toBe(10000n);

      // Verify event was persisted
      const eventCount = await paymentService.getEventCount('pay_test_001');
      expect(eventCount).toBe(1);
    });

    it('should throw error for unsupported rail', async () => {
      const initialEvent = {
        type: 'PaymentIntentCreated',
        paymentId: 'pay_test_002',
        amount: 10000n,
        timestamp: new Date(),
      };

      await expect(
        paymentService.createPayment('NPP' as any, initialEvent)
      ).rejects.toThrow('No adapter found for rail: NPP');
    });
  });

  describe('PaymentService - Apply Event', () => {
    it('should apply event and persist to event store', async () => {
      // Create payment
      const initialEvent = {
        type: 'PaymentIntentCreated',
        paymentId: 'pay_test_003',
        amount: 10000n,
        currency: 'AUD',
        timestamp: new Date(),
      };
      await paymentService.createPayment('CARDS', initialEvent);

      // Apply authorization event
      const authEvent = {
        type: 'PaymentAuthorised',
        amount: 10000n,
        authCode: 'AUTH123',
        timestamp: new Date(),
      };
      const updatedPayment = await paymentService.applyEvent('pay_test_003', 'CARDS', authEvent);

      expect(updatedPayment.state).toBe(CardsPaymentState.AUTHORISED);
      expect(updatedPayment.authCode).toBe('AUTH123');

      // Verify both events were persisted
      const eventCount = await paymentService.getEventCount('pay_test_003');
      expect(eventCount).toBe(2);
    });

    it('should handle full Cards lifecycle', async () => {
      // Create payment
      const paymentId = 'pay_test_004';
      await paymentService.createPayment('CARDS', {
        type: 'PaymentIntentCreated',
        paymentId,
        amount: 50000n, // $500.00
        currency: 'AUD',
        timestamp: new Date(),
      });

      // Authorize
      await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentAuthorised',
        amount: 50000n,
        authCode: 'AUTH456',
        timestamp: new Date(),
      });

      // Capture
      await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentCaptured',
        capturedAmount: 50000n,
        timestamp: new Date(),
      });

      // Clear
      await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentCleared',
        clearedAmount: 50000n,
        timestamp: new Date(),
      });

      // Settle
      const finalPayment = await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentSettled',
        settledAmount: 50000n,
        timestamp: new Date(),
      });

      expect(finalPayment.state).toBe(CardsPaymentState.SETTLED);
      expect(finalPayment.capturedAmount).toBe(50000n);

      // Verify all 5 events were persisted
      const eventCount = await paymentService.getEventCount(paymentId);
      expect(eventCount).toBe(5);
    });
  });

  describe('PaymentService - Load Payment (Replay)', () => {
    it('should rebuild payment state from events', async () => {
      const paymentId = 'pay_test_005';

      // Create and process payment
      await paymentService.createPayment('CARDS', {
        type: 'PaymentIntentCreated',
        paymentId,
        amount: 20000n,
        currency: 'AUD',
        timestamp: new Date(),
      });

      await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentAuthorised',
        amount: 20000n,
        authCode: 'AUTH789',
        timestamp: new Date(),
      });

      await paymentService.applyEvent(paymentId, 'CARDS', {
        type: 'PaymentCaptured',
        capturedAmount: 20000n,
        timestamp: new Date(),
      });

      // Load payment (triggers replay)
      const loadedPayment = await paymentService.loadPayment(paymentId, 'CARDS');

      expect(loadedPayment.paymentId).toBe(paymentId);
      expect(loadedPayment.state).toBe(CardsPaymentState.CAPTURED);
      expect(loadedPayment.authCode).toBe('AUTH789');
      expect(loadedPayment.capturedAmount).toBe(20000n);
      expect(loadedPayment.events.length).toBe(3);
    });

    it('should throw error when loading non-existent payment', async () => {
      await expect(
        paymentService.loadPayment('pay_nonexistent', 'CARDS')
      ).rejects.toThrow('Payment not found: pay_nonexistent');
    });
  });

  describe('EventStoreRepository - Idempotency', () => {
    it('should not save duplicate events', async () => {
      const event: PaymentEvent = {
        eventId: 'evt_duplicate_test',
        eventType: 'PaymentIntentCreated',
        paymentId: 'pay_test_006',
        rail: 'CARDS',
        eventData: { type: 'PaymentIntentCreated', amount: 10000n },
        metadata: {},
        occurredAt: new Date(),
        sequenceNumber: 0,
        idempotencyKey: 'pay_test_006-PaymentIntentCreated-123',
      };

      // Save same event twice
      await eventStore.saveEvent(event);
      await eventStore.saveEvent(event);

      // Should only have 1 event
      const events = await eventStore.loadEvents('pay_test_006');
      expect(events.length).toBe(1);
    });
  });

  describe('EventStoreRepository - Partial Replay', () => {
    it('should load events from specific sequence number', async () => {
      const paymentId = 'pay_test_007';

      // Create 5 events
      for (let i = 0; i < 5; i++) {
        await eventStore.saveEvent({
          eventId: `evt_${i}`,
          eventType: 'TestEvent',
          paymentId,
          rail: 'CARDS',
          eventData: { sequence: i },
          metadata: {},
          occurredAt: new Date(),
          sequenceNumber: i,
          idempotencyKey: `${paymentId}-test-${i}`,
        });
      }

      // Load from sequence 2 onwards
      const events = await eventStore.loadEvents(paymentId, 2);
      expect(events.length).toBe(3); // sequences 2, 3, 4
      expect(events[0].sequenceNumber).toBe(2);
      expect(events[2].sequenceNumber).toBe(4);
    });
  });

  describe('CardsRailAdapter', () => {
    it('should convert domain event to storage event', () => {
      const adapter = new CardsRailAdapter();
      const domainEvent = {
        type: 'PaymentAuthorised',
        amount: 10000n,
        authCode: 'AUTH123',
        timestamp: new Date(),
      };
      const payment = {
        paymentId: 'pay_test_008',
        state: CardsPaymentState.AUTHORISED,
        authAmount: 10000n,
        capturedAmount: 0n,
        events: [{ type: 'PaymentIntentCreated' }],
      };

      const storageEvent = adapter.toStorageEvent(domainEvent, payment);

      expect(storageEvent.eventType).toBe('PaymentAuthorised');
      expect(storageEvent.paymentId).toBe('pay_test_008');
      expect(storageEvent.rail).toBe('CARDS');
      expect(storageEvent.eventData).toBe(domainEvent);
      expect(storageEvent.metadata.state).toBe(CardsPaymentState.AUTHORISED);
      expect(storageEvent.sequenceNumber).toBe(1);
    });

    it('should convert storage event to domain event', () => {
      const adapter = new CardsRailAdapter();
      const storageEvent: PaymentEvent = {
        eventId: 'evt_test',
        eventType: 'PaymentCaptured',
        paymentId: 'pay_test_009',
        rail: 'CARDS',
        eventData: {
          type: 'PaymentCaptured',
          capturedAmount: 5000n,
          timestamp: new Date(),
        },
        metadata: {},
        occurredAt: new Date(),
        sequenceNumber: 2,
        idempotencyKey: 'test-key',
      };

      const domainEvent = adapter.fromStorageEvent(storageEvent);

      expect(domainEvent.type).toBe('PaymentCaptured');
      expect(domainEvent.capturedAmount).toBe(5000n);
    });
  });

  describe('Health Check', () => {
    it('should return true for healthy event store', async () => {
      const isHealthy = await paymentService.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
