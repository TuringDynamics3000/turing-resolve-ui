/**
 * Place Hold Handler
 * 
 * Application layer handler for placing holds on source accounts.
 * This is the first interaction with Deposits Core after payment initiation.
 * 
 * CRITICAL RULES:
 * - Payments emits intent (PAYMENT_HOLD_PLACED)
 * - Deposits Core validates and applies (HOLD_PLACED posting)
 * - If Deposits throws → payment stays INITIATED
 */

import { Payment, PaymentFacts, PaymentError, rebuildPaymentFromFacts } from '../../core/payments';
import type { PlaceHoldCommand, PaymentFact } from '../../core/payments';
import type { PaymentFactStore } from './InitiatePaymentHandler';

/**
 * Deposits hold service interface.
 */
export interface DepositsHoldService {
  /**
   * Place a hold on an account.
   * Returns success or failure with reason.
   */
  placeHold(params: {
    accountId: string;
    holdId: string;
    amount: string;
    currency: string;
    type: 'PAYMENT';
    expiresAt?: string;
  }): Promise<{ success: true } | { success: false; error: string }>;

  /**
   * Release a hold.
   */
  releaseHold(params: {
    accountId: string;
    holdId: string;
  }): Promise<{ success: true } | { success: false; error: string }>;
}

/**
 * Handler result.
 */
export type PlaceHoldResult =
  | { success: true; payment: Payment; facts: readonly PaymentFact[] }
  | { success: false; error: PaymentError };

/**
 * Place hold on source account.
 * 
 * Flow:
 * 1. Load payment facts
 * 2. Rebuild payment state
 * 3. Validate payment is INITIATED
 * 4. Request Deposits Core to place hold
 * 5. If Deposits succeeds, emit PAYMENT_HOLD_PLACED fact
 * 6. If Deposits fails, emit PAYMENT_FAILED fact
 * 7. Return updated payment
 */
export async function placeHold(
  command: PlaceHoldCommand,
  factStore: PaymentFactStore,
  depositsService: DepositsHoldService
): Promise<PlaceHoldResult> {
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

    // 3. Validate payment is INITIATED
    if (payment.state !== 'INITIATED') {
      return {
        success: false,
        error: PaymentError.invalidStateTransition(
          command.paymentId,
          payment.state,
          'HELD'
        ),
      };
    }

    // 4. Request Deposits Core to place hold
    const holdResult = await depositsService.placeHold({
      accountId: payment.fromAccount,
      holdId: command.holdId,
      amount: payment.amount.toDisplayString().split(' ')[0].replace(',', ''),
      currency: payment.amount.currency,
      type: 'PAYMENT',
    });

    if (!holdResult.success) {
      // 6. Deposits failed - emit PAYMENT_FAILED fact
      const failedFact = PaymentFacts.failed(
        command.paymentId,
        `Hold placement failed: ${holdResult.error}`,
        facts.length + 1,
        'HOLD_FAILED',
        true // Recoverable - can retry with different amount or later
      );
      await factStore.appendFact(failedFact);

      return {
        success: false,
        error: PaymentError.depositsCoreRejected(
          'Hold placement failed',
          holdResult.error
        ),
      };
    }

    // 5. Deposits succeeded - emit PAYMENT_HOLD_PLACED fact
    const holdPlacedFact = PaymentFacts.holdPlaced(
      command.paymentId,
      command.holdId,
      payment.amount.toDisplayString().split(' ')[0].replace(',', ''),
      payment.amount.currency,
      facts.length + 1
    );
    await factStore.appendFact(holdPlacedFact);

    // 7. Return updated payment
    const heldPayment = payment.apply(holdPlacedFact);

    return {
      success: true,
      payment: heldPayment,
      facts: [...facts, holdPlacedFact],
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { success: false, error };
    }
    throw error;
  }
}
