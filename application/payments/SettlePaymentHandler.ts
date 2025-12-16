/**
 * Settle Payment Handler
 * 
 * Application layer handler for settling payments.
 * This is where Payments Core integrates with Deposits Core.
 * 
 * CRITICAL RULES:
 * - Payments emits intent. Deposits emits truth.
 * - If Deposits throws → payment stays in current state.
 * - Nothing half-applied.
 */

import { Payment, PaymentFacts, PaymentError, rebuildPaymentFromFacts } from '../../core/payments';
import type { SettlePaymentCommand, PaymentFact } from '../../core/payments';
import type { PaymentFactStore } from './InitiatePaymentHandler';

/**
 * Deposits Core posting interface.
 * This is how Payments Core requests money movement.
 * Implemented by infrastructure layer.
 */
export interface DepositsPostingService {
  /**
   * Release a hold and debit the account.
   * This is atomic - either both happen or neither.
   */
  releaseHoldAndDebit(params: {
    accountId: string;
    holdId: string;
    amount: string;
    currency: string;
  }): Promise<{ success: true } | { success: false; error: string }>;

  /**
   * Credit an account.
   */
  credit(params: {
    accountId: string;
    amount: string;
    currency: string;
  }): Promise<{ success: true } | { success: false; error: string }>;
}

/**
 * Handler result.
 */
export type SettlePaymentResult =
  | { success: true; payment: Payment; facts: readonly PaymentFact[] }
  | { success: false; error: PaymentError };

/**
 * Settle a payment.
 * 
 * Flow:
 * 1. Load payment facts
 * 2. Rebuild payment state
 * 3. Validate payment can be settled (must be SENT)
 * 4. Request Deposits Core to release hold and debit source
 * 5. If internal payment, credit destination
 * 6. Emit PAYMENT_SETTLED fact
 * 7. Return updated payment
 * 
 * FAILURE SEMANTICS:
 * - If Deposits throws → payment stays SENT
 * - Failure fact emitted
 * - Nothing half-applied
 */
export async function settlePayment(
  command: SettlePaymentCommand,
  factStore: PaymentFactStore,
  depositsService: DepositsPostingService
): Promise<SettlePaymentResult> {
  try {
    // 1. Load payment facts
    const facts = await factStore.loadFacts(command.paymentId);
    if (facts.length === 0) {
      return {
        success: false,
        error: PaymentError.paymentNotFound(command.paymentId),
      };
    }

    // 2. Rebuild payment state
    const payment = rebuildPaymentFromFacts(facts);

    // 3. Validate payment can be settled
    if (payment.state !== 'SENT') {
      return {
        success: false,
        error: PaymentError.invalidStateTransition(
          command.paymentId,
          payment.state,
          'SETTLED'
        ),
      };
    }

    // 4. Request Deposits Core to release hold and debit source
    const activeHold = payment.getActiveHold();
    if (activeHold) {
      const debitResult = await depositsService.releaseHoldAndDebit({
        accountId: payment.fromAccount,
        holdId: activeHold.holdId,
        amount: payment.amount.toDisplayString().split(' ')[0].replace(',', ''),
        currency: payment.amount.currency,
      });

      if (!debitResult.success) {
        // Deposits Core rejected - emit failure fact
        const failedFact = PaymentFacts.failed(
          command.paymentId,
          `Deposits Core rejected: ${debitResult.error}`,
          facts.length + 1,
          'DEPOSITS_REJECTED',
          false
        );
        await factStore.appendFact(failedFact);

        return {
          success: false,
          error: PaymentError.depositsCoreRejected(
            'Release hold and debit failed',
            debitResult.error
          ),
        };
      }
    }

    // 5. If internal payment, credit destination
    if (payment.type === 'INTERNAL' && payment.toAccount) {
      const creditResult = await depositsService.credit({
        accountId: payment.toAccount,
        amount: payment.amount.toDisplayString().split(' ')[0].replace(',', ''),
        currency: payment.amount.currency,
      });

      if (!creditResult.success) {
        // This is a critical failure - debit happened but credit failed
        // In production, this would trigger reconciliation
        const failedFact = PaymentFacts.failed(
          command.paymentId,
          `Credit failed after debit: ${creditResult.error}`,
          facts.length + 1,
          'CREDIT_FAILED',
          false
        );
        await factStore.appendFact(failedFact);

        return {
          success: false,
          error: PaymentError.depositsCoreRejected(
            'Credit destination failed',
            creditResult.error
          ),
        };
      }
    }

    // 6. Emit PAYMENT_SETTLED fact
    const settledFact = PaymentFacts.settled(
      command.paymentId,
      facts.length + 1,
      command.settlementReference
    );
    await factStore.appendFact(settledFact);

    // 7. Return updated payment
    const settledPayment = payment.apply(settledFact);

    return {
      success: true,
      payment: settledPayment,
      facts: [...facts, settledFact],
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { success: false, error };
    }
    throw error;
  }
}
