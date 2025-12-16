import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  emitPaymentFact, 
  emitDepositFact, 
  emitSafeguardChange,
  getEventsSince,
  factEventEmitter,
  type PaymentFactEvent,
  type DepositFactEvent,
  type SafeguardChangeEvent,
} from '../factStream';

describe('Fact Stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('emitPaymentFact', () => {
    it('emits payment fact event with correct structure', () => {
      const listener = vi.fn();
      factEventEmitter.on('fact', listener);

      const eventId = emitPaymentFact('PAY-123', 'FACT-456', 'PAYMENT_INITIATED', 1);

      expect(eventId).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(1);
      
      const emittedEvent = listener.mock.calls[0][0];
      expect(emittedEvent.event.type).toBe('payment_fact');
      expect(emittedEvent.event.paymentId).toBe('PAY-123');
      expect(emittedEvent.event.factId).toBe('FACT-456');
      expect(emittedEvent.event.factType).toBe('PAYMENT_INITIATED');
      expect(emittedEvent.event.sequence).toBe(1);
      expect(emittedEvent.event.occurredAt).toBeDefined();

      factEventEmitter.off('fact', listener);
    });

    it('increments event ID for each emission', () => {
      const id1 = emitPaymentFact('PAY-1', 'FACT-1', 'PAYMENT_INITIATED', 1);
      const id2 = emitPaymentFact('PAY-2', 'FACT-2', 'PAYMENT_HOLD_PLACED', 2);
      const id3 = emitPaymentFact('PAY-3', 'FACT-3', 'PAYMENT_SETTLED', 3);

      expect(id2).toBe(id1 + 1);
      expect(id3).toBe(id2 + 1);
    });
  });

  describe('emitDepositFact', () => {
    it('emits deposit fact event with correct structure', () => {
      const listener = vi.fn();
      factEventEmitter.on('fact', listener);

      const eventId = emitDepositFact('DEP-ACC-123', 'FACT-789', 'POSTING_APPLIED', 5);

      expect(eventId).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(1);
      
      const emittedEvent = listener.mock.calls[0][0];
      expect(emittedEvent.event.type).toBe('deposit_fact');
      expect(emittedEvent.event.accountId).toBe('DEP-ACC-123');
      expect(emittedEvent.event.factId).toBe('FACT-789');
      expect(emittedEvent.event.factType).toBe('POSTING_APPLIED');
      expect(emittedEvent.event.sequence).toBe(5);

      factEventEmitter.off('fact', listener);
    });
  });

  describe('emitSafeguardChange', () => {
    it('emits kill switch change event', () => {
      const listener = vi.fn();
      factEventEmitter.on('fact', listener);

      const eventId = emitSafeguardChange('kill_switch', 'NPP', 'DISABLED', 'Maintenance', 'admin@example.com');

      expect(eventId).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(1);
      
      const emittedEvent = listener.mock.calls[0][0];
      expect(emittedEvent.event.type).toBe('safeguard_change');
      expect(emittedEvent.event.safeguardType).toBe('kill_switch');
      expect(emittedEvent.event.scheme).toBe('NPP');
      expect(emittedEvent.event.newState).toBe('DISABLED');
      expect(emittedEvent.event.reason).toBe('Maintenance');
      expect(emittedEvent.event.actor).toBe('admin@example.com');

      factEventEmitter.off('fact', listener);
    });

    it('emits circuit breaker change event', () => {
      const listener = vi.fn();
      factEventEmitter.on('fact', listener);

      const eventId = emitSafeguardChange('circuit_breaker', 'NPP', 'OPEN');

      expect(eventId).toBeGreaterThan(0);
      
      const emittedEvent = listener.mock.calls[0][0];
      expect(emittedEvent.event.safeguardType).toBe('circuit_breaker');
      expect(emittedEvent.event.newState).toBe('OPEN');

      factEventEmitter.off('fact', listener);
    });
  });

  describe('getEventsSince', () => {
    it('returns events since given ID', () => {
      // Emit some events
      const id1 = emitPaymentFact('PAY-A', 'FACT-A', 'PAYMENT_INITIATED', 1);
      const id2 = emitPaymentFact('PAY-B', 'FACT-B', 'PAYMENT_HOLD_PLACED', 2);
      const id3 = emitPaymentFact('PAY-C', 'FACT-C', 'PAYMENT_SETTLED', 3);

      // Get events since id1
      const eventsSinceId1 = getEventsSince(id1);
      expect(eventsSinceId1.length).toBe(2);
      expect(eventsSinceId1[0].id).toBe(id2);
      expect(eventsSinceId1[1].id).toBe(id3);

      // Get events since id2
      const eventsSinceId2 = getEventsSince(id2);
      expect(eventsSinceId2.length).toBe(1);
      expect(eventsSinceId2[0].id).toBe(id3);
    });

    it('returns empty array when no events after given ID', () => {
      const id = emitPaymentFact('PAY-X', 'FACT-X', 'PAYMENT_INITIATED', 1);
      const events = getEventsSince(id);
      expect(events.length).toBe(0);
    });
  });

  describe('Event stream principles', () => {
    it('streams fact IDs only, not computed state', () => {
      const listener = vi.fn();
      factEventEmitter.on('fact', listener);

      emitPaymentFact('PAY-123', 'FACT-456', 'PAYMENT_SETTLED', 4);

      const emittedEvent = listener.mock.calls[0][0].event as PaymentFactEvent;
      
      // Event should contain identifiers, not computed state
      expect(emittedEvent).toHaveProperty('paymentId');
      expect(emittedEvent).toHaveProperty('factId');
      expect(emittedEvent).toHaveProperty('factType');
      expect(emittedEvent).toHaveProperty('sequence');
      
      // Event should NOT contain computed state like balance or full payment object
      expect(emittedEvent).not.toHaveProperty('balance');
      expect(emittedEvent).not.toHaveProperty('payment');
      expect(emittedEvent).not.toHaveProperty('state');

      factEventEmitter.off('fact', listener);
    });

    it('supports multiple concurrent listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      factEventEmitter.on('fact', listener1);
      factEventEmitter.on('fact', listener2);
      factEventEmitter.on('fact', listener3);

      emitPaymentFact('PAY-MULTI', 'FACT-MULTI', 'PAYMENT_INITIATED', 1);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      factEventEmitter.off('fact', listener1);
      factEventEmitter.off('fact', listener2);
      factEventEmitter.off('fact', listener3);
    });
  });
});
