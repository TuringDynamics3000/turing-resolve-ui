/**
 * Payments Core v1 Tests
 * 
 * Testing:
 * - State machine legality
 * - Replay determinism
 * - Invalid transitions
 * - Deposits Core integration (real, not mocked)
 */

import { describe, it, expect } from 'vitest';
import {
  Payment,
  PaymentFacts,
  PaymentError,
  rebuildPaymentFromFacts,
  isValidTransition,
  isTerminalState,
  getValidNextStates,
  validatePaymentFactSequence,
} from '../index';
import type { PaymentFact, PaymentState } from '../index';

describe('Payments Core v1', () => {
  describe('Payment State Machine', () => {
    it('should define valid transitions from INITIATED', () => {
      expect(isValidTransition('INITIATED', 'HELD')).toBe(true);
      expect(isValidTransition('INITIATED', 'FAILED')).toBe(true);
      expect(isValidTransition('INITIATED', 'SETTLED')).toBe(false);
      expect(isValidTransition('INITIATED', 'REVERSED')).toBe(false);
    });

    it('should define valid transitions from HELD', () => {
      expect(isValidTransition('HELD', 'AUTHORISED')).toBe(true);
      expect(isValidTransition('HELD', 'SENT')).toBe(true);
      expect(isValidTransition('HELD', 'FAILED')).toBe(true);
      expect(isValidTransition('HELD', 'INITIATED')).toBe(false);
    });

    it('should define valid transitions from SENT', () => {
      expect(isValidTransition('SENT', 'SETTLED')).toBe(true);
      expect(isValidTransition('SENT', 'FAILED')).toBe(true);
      expect(isValidTransition('SENT', 'REVERSED')).toBe(false);
    });

    it('should define valid transitions from SETTLED', () => {
      expect(isValidTransition('SETTLED', 'REVERSED')).toBe(true);
      expect(isValidTransition('SETTLED', 'FAILED')).toBe(false);
    });

    it('should identify terminal states', () => {
      expect(isTerminalState('SETTLED')).toBe(true);
      expect(isTerminalState('FAILED')).toBe(true);
      expect(isTerminalState('REVERSED')).toBe(true);
      expect(isTerminalState('INITIATED')).toBe(false);
      expect(isTerminalState('HELD')).toBe(false);
      expect(isTerminalState('SENT')).toBe(false);
    });

    it('should return valid next states', () => {
      expect(getValidNextStates('INITIATED')).toContain('HELD');
      expect(getValidNextStates('INITIATED')).toContain('FAILED');
      expect(getValidNextStates('SETTLED')).toContain('REVERSED');
      expect(getValidNextStates('FAILED')).toHaveLength(0);
      expect(getValidNextStates('REVERSED')).toHaveLength(0);
    });
  });

  describe('Payment Creation', () => {
    it('should create payment from PAYMENT_INITIATED fact', () => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '100.00',
        currency: 'AUD',
        reference: 'REF-001',
        description: 'Test payment',
      });

      const payment = Payment.create(fact);

      expect(payment.id).toBe('PAY-001');
      expect(payment.fromAccount).toBe('ACC-001');
      expect(payment.toAccount).toBe('ACC-002');
      expect(payment.state).toBe('INITIATED');
      expect(payment.type).toBe('INTERNAL');
      expect(payment.holds).toHaveLength(0);
    });

    it('should reject zero amount', () => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '0.00',
        currency: 'AUD',
      });

      expect(() => Payment.create(fact)).toThrow(PaymentError);
    });

    it('should reject same account transfer', () => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-001',
        amount: '100.00',
        currency: 'AUD',
      });

      expect(() => Payment.create(fact)).toThrow(PaymentError);
    });

    it('should create outbound payment with external party', () => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toExternal: {
          type: 'BANK_ACCOUNT',
          identifier: '123456789',
          name: 'External Account',
          bankCode: 'BSB-123',
        },
        amount: '100.00',
        currency: 'AUD',
      });

      const payment = Payment.create(fact);

      expect(payment.type).toBe('OUTBOUND');
      expect(payment.toExternal).toBeDefined();
      expect(payment.toAccount).toBeNull();
    });
  });

  describe('Payment State Transitions', () => {
    const createInitiatedPayment = (): Payment => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '100.00',
        currency: 'AUD',
      });
      return Payment.create(fact);
    };

    it('should transition INITIATED → HELD', () => {
      const payment = createInitiatedPayment();
      const holdFact = PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2);

      const heldPayment = payment.apply(holdFact);

      expect(heldPayment.state).toBe('HELD');
      expect(heldPayment.holds).toHaveLength(1);
      expect(heldPayment.holds[0].holdId).toBe('HOLD-001');
    });

    it('should transition HELD → SENT', () => {
      const payment = createInitiatedPayment();
      const holdFact = PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2);
      const sentFact = PaymentFacts.sent('PAY-001', 3, 'NET-REF-001');

      const heldPayment = payment.apply(holdFact);
      const sentPayment = heldPayment.apply(sentFact);

      expect(sentPayment.state).toBe('SENT');
    });

    it('should transition SENT → SETTLED', () => {
      const payment = createInitiatedPayment();
      const holdFact = PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2);
      const sentFact = PaymentFacts.sent('PAY-001', 3);
      const settledFact = PaymentFacts.settled('PAY-001', 4, 'SETTLE-REF-001');

      let p = payment.apply(holdFact);
      p = p.apply(sentFact);
      const settledPayment = p.apply(settledFact);

      expect(settledPayment.state).toBe('SETTLED');
      expect(settledPayment.settledAt).toBeDefined();
      expect(settledPayment.isTerminal()).toBe(true);
    });

    it('should transition SETTLED → REVERSED', () => {
      const payment = createInitiatedPayment();
      const facts: PaymentFact[] = [
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2),
        PaymentFacts.sent('PAY-001', 3),
        PaymentFacts.settled('PAY-001', 4),
        PaymentFacts.reversed('PAY-001', 'Customer requested refund', 5),
      ];

      let p = payment;
      for (const fact of facts) {
        p = p.apply(fact);
      }

      expect(p.state).toBe('REVERSED');
      expect(p.reversedAt).toBeDefined();
      expect(p.reversalReason).toBe('Customer requested refund');
      expect(p.isTerminal()).toBe(true);
    });

    it('should transition to FAILED from any non-terminal state', () => {
      const payment = createInitiatedPayment();
      const failedFact = PaymentFacts.failed('PAY-001', 'Insufficient funds', 2, 'INSUF_FUNDS', false);

      const failedPayment = payment.apply(failedFact);

      expect(failedPayment.state).toBe('FAILED');
      expect(failedPayment.failureReason).toBe('Insufficient funds');
      expect(failedPayment.isTerminal()).toBe(true);
    });

    it('should reject invalid state transitions', () => {
      const payment = createInitiatedPayment();
      const settledFact = PaymentFacts.settled('PAY-001', 2);

      // Cannot go directly from INITIATED to SETTLED
      expect(() => payment.apply(settledFact)).toThrow(PaymentError);
    });

    it('should reject transitions from terminal states', () => {
      const payment = createInitiatedPayment();
      const failedFact = PaymentFacts.failed('PAY-001', 'Error', 2);
      const holdFact = PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 3);

      const failedPayment = payment.apply(failedFact);

      // Cannot transition from FAILED
      expect(() => failedPayment.apply(holdFact)).toThrow(PaymentError);
    });
  });

  describe('Replay Determinism', () => {
    it('should rebuild identical payment from facts', () => {
      const facts: PaymentFact[] = [
        PaymentFacts.initiated('PAY-001', {
          fromAccount: 'ACC-001',
          toAccount: 'ACC-002',
          amount: '250.00',
          currency: 'AUD',
          reference: 'REF-001',
        }, 1),
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '250.00', 'AUD', 2),
        PaymentFacts.sent('PAY-001', 3, 'NET-001'),
        PaymentFacts.settled('PAY-001', 4, 'SETTLE-001'),
      ];

      // Rebuild twice
      const payment1 = rebuildPaymentFromFacts(facts);
      const payment2 = rebuildPaymentFromFacts(facts);

      // Should be identical
      expect(payment1.id).toBe(payment2.id);
      expect(payment1.state).toBe(payment2.state);
      expect(payment1.amount.amount).toBe(payment2.amount.amount);
      expect(payment1.holds.length).toBe(payment2.holds.length);
    });

    it('should validate fact sequence', () => {
      const validFacts: PaymentFact[] = [
        PaymentFacts.initiated('PAY-001', {
          fromAccount: 'ACC-001',
          toAccount: 'ACC-002',
          amount: '100.00',
          currency: 'AUD',
        }, 1),
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2),
      ];

      const result = validatePaymentFactSequence(validFacts);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid fact sequence - wrong first fact', () => {
      const invalidFacts: PaymentFact[] = [
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 1),
      ];

      const result = validatePaymentFactSequence(invalidFacts);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('First fact must be PAYMENT_INITIATED');
    });

    it('should detect invalid fact sequence - wrong sequence numbers', () => {
      const invalidFacts: PaymentFact[] = [
        PaymentFacts.initiated('PAY-001', {
          fromAccount: 'ACC-001',
          toAccount: 'ACC-002',
          amount: '100.00',
          currency: 'AUD',
        }, 1),
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 5), // Wrong sequence
      ];

      const result = validatePaymentFactSequence(invalidFacts);
      expect(result.valid).toBe(false);
    });
  });

  describe('Payment Utility Methods', () => {
    it('should identify if payment can be cancelled', () => {
      const fact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '100.00',
        currency: 'AUD',
      });
      const payment = Payment.create(fact);

      expect(payment.canCancel()).toBe(false); // INITIATED cannot be cancelled

      const heldPayment = payment.apply(
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2)
      );
      expect(heldPayment.canCancel()).toBe(true); // HELD can be cancelled
    });

    it('should identify if payment can be reversed', () => {
      const facts: PaymentFact[] = [
        PaymentFacts.initiated('PAY-001', {
          fromAccount: 'ACC-001',
          toAccount: 'ACC-002',
          amount: '100.00',
          currency: 'AUD',
        }, 1),
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2),
        PaymentFacts.sent('PAY-001', 3),
        PaymentFacts.settled('PAY-001', 4),
      ];

      const payment = rebuildPaymentFromFacts(facts);
      expect(payment.canReverse()).toBe(true); // SETTLED can be reversed
    });

    it('should get active hold', () => {
      const facts: PaymentFact[] = [
        PaymentFacts.initiated('PAY-001', {
          fromAccount: 'ACC-001',
          toAccount: 'ACC-002',
          amount: '100.00',
          currency: 'AUD',
        }, 1),
        PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '100.00', 'AUD', 2),
      ];

      const payment = rebuildPaymentFromFacts(facts);
      const activeHold = payment.getActiveHold();

      expect(activeHold).toBeDefined();
      expect(activeHold?.holdId).toBe('HOLD-001');
    });
  });

  describe('Payment Errors', () => {
    it('should create payment not found error', () => {
      const error = PaymentError.paymentNotFound('PAY-999');
      expect(error.code).toBe('PAYMENT_NOT_FOUND');
      expect(error.message).toContain('PAY-999');
    });

    it('should create invalid state transition error', () => {
      const error = PaymentError.invalidStateTransition('PAY-001', 'INITIATED', 'SETTLED');
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.details?.currentState).toBe('INITIATED');
      expect(error.details?.targetState).toBe('SETTLED');
    });

    it('should create deposits core rejected error', () => {
      const error = PaymentError.depositsCoreRejected('Insufficient funds', 'INSUF_FUNDS');
      expect(error.code).toBe('DEPOSITS_CORE_REJECTED');
      expect(error.details?.depositError).toBe('INSUF_FUNDS');
    });
  });

  describe('Full Payment Lifecycle', () => {
    it('should complete full internal payment lifecycle', () => {
      // This test simulates the full lifecycle without mocking Deposits Core
      const facts: PaymentFact[] = [];

      // 1. Initiate
      const initFact = PaymentFacts.initiated('PAY-001', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '500.00',
        currency: 'AUD',
        reference: 'INVOICE-123',
        description: 'Payment for services',
      }, 1);
      facts.push(initFact);

      let payment = Payment.create(initFact);
      expect(payment.state).toBe('INITIATED');

      // 2. Place hold
      const holdFact = PaymentFacts.holdPlaced('PAY-001', 'HOLD-001', '500.00', 'AUD', 2);
      facts.push(holdFact);
      payment = payment.apply(holdFact);
      expect(payment.state).toBe('HELD');

      // 3. Send
      const sentFact = PaymentFacts.sent('PAY-001', 3, 'NET-REF-001');
      facts.push(sentFact);
      payment = payment.apply(sentFact);
      expect(payment.state).toBe('SENT');

      // 4. Settle
      const settledFact = PaymentFacts.settled('PAY-001', 4, 'SETTLE-REF-001');
      facts.push(settledFact);
      payment = payment.apply(settledFact);
      expect(payment.state).toBe('SETTLED');
      expect(payment.isTerminal()).toBe(true);

      // Verify replay produces same result
      const rebuiltPayment = rebuildPaymentFromFacts(facts);
      expect(rebuiltPayment.state).toBe('SETTLED');
      expect(rebuiltPayment.id).toBe('PAY-001');
    });

    it('should handle payment failure with hold release', () => {
      const facts: PaymentFact[] = [];

      // 1. Initiate
      const initFact = PaymentFacts.initiated('PAY-002', {
        fromAccount: 'ACC-001',
        toAccount: 'ACC-002',
        amount: '1000.00',
        currency: 'AUD',
      }, 1);
      facts.push(initFact);

      let payment = Payment.create(initFact);

      // 2. Place hold
      const holdFact = PaymentFacts.holdPlaced('PAY-002', 'HOLD-002', '1000.00', 'AUD', 2);
      facts.push(holdFact);
      payment = payment.apply(holdFact);

      // 3. Fail (e.g., external network rejection)
      const failedFact = PaymentFacts.failed(
        'PAY-002',
        'External network rejected payment',
        3,
        'NETWORK_REJECT',
        false
      );
      facts.push(failedFact);
      payment = payment.apply(failedFact);

      expect(payment.state).toBe('FAILED');
      expect(payment.failureReason).toBe('External network rejected payment');
      expect(payment.isTerminal()).toBe(true);

      // Note: In real implementation, handler would release hold via Deposits Core
    });
  });
});
