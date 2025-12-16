/**
 * Initiate Payment Handler
 * 
 * Application layer handler for initiating payments.
 * 
 * CRITICAL RULES:
 * - Handlers orchestrate. They do not decide.
 * - Load facts, validate command, call policies, emit facts, apply postings.
 * - If handler contains an `if` that isn't about control flow, that's a smell.
 */

import { Payment, PaymentFacts, PaymentError } from '../../core/payments';
import type { InitiatePaymentCommand, PaymentFact } from '../../core/payments';

/**
 * Payment fact store interface.
 * Implemented by infrastructure layer.
 */
export interface PaymentFactStore {
  loadFacts(paymentId: string): Promise<readonly PaymentFact[]>;
  appendFact(fact: PaymentFact): Promise<void>;
  getNextSequence(paymentId: string): Promise<number>;
}

/**
 * Handler result.
 */
export type InitiatePaymentResult =
  | { success: true; payment: Payment; facts: readonly PaymentFact[] }
  | { success: false; error: PaymentError };

/**
 * Initiate a new payment.
 * 
 * Flow:
 * 1. Check payment doesn't already exist
 * 2. Create PAYMENT_INITIATED fact
 * 3. Create Payment from fact
 * 4. Persist fact
 * 5. Return payment
 * 
 * Note: Hold placement is a separate step (PlaceHoldHandler).
 */
export async function initiatePayment(
  command: InitiatePaymentCommand,
  factStore: PaymentFactStore
): Promise<InitiatePaymentResult> {
  try {
    // 1. Check payment doesn't already exist
    const existingFacts = await factStore.loadFacts(command.paymentId);
    if (existingFacts.length > 0) {
      return {
        success: false,
        error: PaymentError.paymentAlreadyExists(command.paymentId),
      };
    }

    // 2. Create PAYMENT_INITIATED fact
    const sequence = await factStore.getNextSequence(command.paymentId);
    const initiatedFact = PaymentFacts.initiated(
      command.paymentId,
      {
        fromAccount: command.fromAccount,
        toAccount: command.toAccount,
        toExternal: command.toExternal,
        amount: command.amount,
        currency: command.currency,
        reference: command.reference,
        description: command.description,
      },
      sequence
    );

    // 3. Create Payment from fact
    const payment = Payment.create(initiatedFact);

    // 4. Persist fact
    await factStore.appendFact(initiatedFact);

    // 5. Return payment
    return {
      success: true,
      payment,
      facts: [initiatedFact],
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { success: false, error };
    }
    throw error;
  }
}
