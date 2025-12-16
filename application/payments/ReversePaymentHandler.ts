/**
 * Reverse Payment Handler
 * 
 * Application layer handler for reversing settled payments.
 * Emits CREDIT to Deposits Core (refund).
 * 
 * CRITICAL RULES:
 * - Can only reverse SETTLED payments
 * - Reversal emits CREDIT to source account
 * - This is a refund, not an undo
 */

import { Payment, PaymentFacts, PaymentError, rebuildPaymentFromFacts } from '../../core/payments';
import type { ReversePaymentCommand, PaymentFact } from '../../core/payments';
import type { PaymentFactStore } from './InitiatePaymentHandler';
import type { DepositsPostingService } from './SettlePaymentHandler';

/**
 * Handler result.
 */
export type ReversePaymentResult =
  | { success: true; payment: Payment; facts: readonly PaymentFact[] }
  | { success: false; error: PaymentError };

/**
 * Reverse a settled payment.
 * 
 * Flow:
 * 1. Load payment facts
 * 2. Rebuild payment state
 * 3. Validate payment can be reversed (must be SETTLED)
 * 4. Request Deposits Core to credit source (refund)
 * 5. Emit PAYMENT_REVERSED fact
 * 6. Return updated payment
 */
export async function reversePayment(
  command: ReversePaymentCommand,
  factStore: PaymentFactStore,
  depositsService: DepositsPostingService
): Promise<ReversePaymentResult> {
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

    // 3. Validate payment can be reversed
    if (payment.state !== 'SETTLED') {
      return {
        success: false,
        error: PaymentError.cannotReverseUnsettled(command.paymentId, payment.state),
      };
    }

    // 4. Request Deposits Core to credit source (refund)
    const creditResult = await depositsService.credit({
      accountId: payment.fromAccount,
      amount: payment.amount.toDisplayString().split(' ')[0].replace(',', ''),
      currency: payment.amount.currency,
    });

    if (!creditResult.success) {
      return {
        success: false,
        error: PaymentError.depositsCoreRejected(
          'Refund credit failed',
          creditResult.error
        ),
      };
    }

    // 5. Emit PAYMENT_REVERSED fact
    const reversedFact = PaymentFacts.reversed(
      command.paymentId,
      command.reason,
      facts.length + 1
    );
    await factStore.appendFact(reversedFact);

    // 6. Return updated payment
    const reversedPayment = payment.apply(reversedFact);

    return {
      success: true,
      payment: reversedPayment,
      facts: [...facts, reversedFact],
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { success: false, error };
    }
    throw error;
  }
}
