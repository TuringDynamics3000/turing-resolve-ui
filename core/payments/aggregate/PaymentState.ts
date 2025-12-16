/**
 * Payment State Machine
 * 
 * Deterministic state transitions for payments.
 * Forward-only progression unless explicitly reversed.
 * No implicit transitions. No magic retries.
 * 
 * CRITICAL: Payment state ≠ account state.
 * This is about the payment lifecycle, not balances.
 */

/**
 * All possible payment states.
 */
export type PaymentState =
  | 'INITIATED'    // Payment created, no hold yet
  | 'HELD'         // Funds held on source account
  | 'AUTHORISED'   // Payment authorised (for card payments, etc.)
  | 'SENT'         // Payment sent to external network
  | 'SETTLED'      // Payment completed successfully
  | 'FAILED'       // Payment failed (terminal)
  | 'REVERSED';    // Payment reversed after settlement (terminal)

/**
 * Terminal states - no further transitions allowed.
 */
export const TERMINAL_STATES: readonly PaymentState[] = [
  'SETTLED',
  'FAILED',
  'REVERSED',
] as const;

/**
 * Valid state transitions.
 * Key: current state
 * Value: array of valid next states
 */
export const VALID_TRANSITIONS: Record<PaymentState, readonly PaymentState[]> = {
  INITIATED: ['HELD', 'FAILED'],
  HELD: ['AUTHORISED', 'SENT', 'FAILED'],
  AUTHORISED: ['SENT', 'FAILED'],
  SENT: ['SETTLED', 'FAILED'],
  SETTLED: ['REVERSED'],
  FAILED: [],      // Terminal
  REVERSED: [],    // Terminal
} as const;

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(from: PaymentState, to: PaymentState): boolean {
  const validNextStates = VALID_TRANSITIONS[from];
  return validNextStates.includes(to);
}

/**
 * Check if a state is terminal (no further transitions).
 */
export function isTerminalState(state: PaymentState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Get all valid next states from current state.
 */
export function getValidNextStates(state: PaymentState): readonly PaymentState[] {
  return VALID_TRANSITIONS[state];
}

/**
 * State descriptions for UI/logging.
 */
export const STATE_DESCRIPTIONS: Record<PaymentState, string> = {
  INITIATED: 'Payment initiated, awaiting hold placement',
  HELD: 'Funds held on source account',
  AUTHORISED: 'Payment authorised, ready to send',
  SENT: 'Payment sent to network, awaiting settlement',
  SETTLED: 'Payment completed successfully',
  FAILED: 'Payment failed',
  REVERSED: 'Payment reversed after settlement',
} as const;

/**
 * State to Deposits Core posting mapping.
 * This defines what deposit postings are emitted for each state transition.
 */
export type DepositPostingIntent =
  | { type: 'HOLD_PLACED'; holdId: string; amount: string; currency: string }
  | { type: 'HOLD_RELEASED'; holdId: string }
  | { type: 'DEBIT'; amount: string; currency: string }
  | { type: 'CREDIT'; amount: string; currency: string };

/**
 * Get the deposit posting intent for a state transition.
 * Returns null if no deposit posting is required.
 */
export function getDepositPostingIntent(
  from: PaymentState,
  to: PaymentState,
  context: {
    holdId?: string;
    amount?: string;
    currency?: string;
  }
): DepositPostingIntent | null {
  // INITIATED → HELD: Place hold
  if (from === 'INITIATED' && to === 'HELD') {
    if (!context.holdId || !context.amount || !context.currency) {
      throw new Error('Hold placement requires holdId, amount, and currency');
    }
    return {
      type: 'HOLD_PLACED',
      holdId: context.holdId,
      amount: context.amount,
      currency: context.currency,
    };
  }

  // HELD → FAILED: Release hold
  if (from === 'HELD' && to === 'FAILED') {
    if (!context.holdId) {
      throw new Error('Hold release requires holdId');
    }
    return {
      type: 'HOLD_RELEASED',
      holdId: context.holdId,
    };
  }

  // SENT → SETTLED: Debit source (hold released implicitly)
  // Note: The actual debit happens when settling
  if (from === 'SENT' && to === 'SETTLED') {
    if (!context.amount || !context.currency) {
      throw new Error('Settlement requires amount and currency');
    }
    return {
      type: 'DEBIT',
      amount: context.amount,
      currency: context.currency,
    };
  }

  // SETTLED → REVERSED: Credit source (refund)
  if (from === 'SETTLED' && to === 'REVERSED') {
    if (!context.amount || !context.currency) {
      throw new Error('Reversal requires amount and currency');
    }
    return {
      type: 'CREDIT',
      amount: context.amount,
      currency: context.currency,
    };
  }

  return null;
}
