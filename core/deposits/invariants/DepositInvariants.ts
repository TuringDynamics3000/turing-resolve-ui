/**
 * DepositInvariants.ts - Frozen Logic
 * 
 * Deposits Core v1 - The Immutable Banking Primitive
 * 
 * Design Principles:
 * - ALL invariants in ONE place
 * - Deterministic - same input = same output
 * - Replay-safe - no side effects
 * - Easy to reason about
 * - Hard to accidentally break
 * 
 * CRITICAL: If an invariant changes, that is a breaking banking change
 * requiring formal review.
 */

import { DepositAccount } from "../aggregate/DepositAccount";
import { Balance } from "../aggregate/Balance";
import { Hold } from "../aggregate/Hold";
import { Posting } from "../ledger/Posting";

/**
 * Apply a posting to an account, returning a new account state.
 * 
 * This is the ONLY way to change account state.
 * All invariants are enforced here.
 * 
 * @param account - The current account state
 * @param posting - The posting to apply
 * @returns A new DepositAccount with the posting applied
 * @throws Error if any invariant is violated
 */
export function applyPosting(
  account: DepositAccount,
  posting: Posting
): DepositAccount {
  // INVARIANT: Cannot apply postings to closed accounts
  if (account.status === "CLOSED") {
    throw new Error("ACCOUNT_CLOSED");
  }

  switch (posting.type) {
    case "CREDIT": {
      // Credit increases both ledger and available
      const newLedger = account.balance.ledger.add(posting.amount);
      const newAvailable = account.balance.available.add(posting.amount);
      return new DepositAccount(
        account.id,
        new Balance(newLedger, newAvailable),
        account.holds,
        account.status
      );
    }

    case "DEBIT": {
      // Debit decreases both available and ledger
      // INVARIANT: Cannot debit more than available (throws INSUFFICIENT_FUNDS)
      const newAvailable = account.balance.available.subtract(posting.amount);
      const newLedger = account.balance.ledger.subtract(posting.amount);
      return new DepositAccount(
        account.id,
        new Balance(newLedger, newAvailable),
        account.holds,
        account.status
      );
    }

    case "HOLD_PLACED": {
      // INVARIANT: Hold IDs must be unique
      if (account.holds.find(h => h.id === posting.holdId)) {
        throw new Error("HOLD_ALREADY_EXISTS");
      }
      
      // Hold decreases available but NOT ledger
      // INVARIANT: Cannot place hold for more than available (throws INSUFFICIENT_FUNDS)
      const newAvailable = account.balance.available.subtract(posting.amount);
      const newHold = new Hold(posting.holdId, posting.amount);
      
      return new DepositAccount(
        account.id,
        new Balance(account.balance.ledger, newAvailable),
        [...account.holds, newHold],
        account.status
      );
    }

    case "HOLD_RELEASED": {
      // INVARIANT: Hold must exist to be released
      const hold = account.holds.find(h => h.id === posting.holdId);
      if (!hold) {
        throw new Error("HOLD_NOT_FOUND");
      }
      
      // Release increases available (ledger unchanged)
      const newAvailable = account.balance.available.add(hold.amount);
      const newHolds = account.holds.filter(h => h.id !== posting.holdId);
      
      return new DepositAccount(
        account.id,
        new Balance(account.balance.ledger, newAvailable),
        newHolds,
        account.status
      );
    }

    case "INTEREST_ACCRUED": {
      // Interest increases both ledger and available (same as credit)
      const newLedger = account.balance.ledger.add(posting.amount);
      const newAvailable = account.balance.available.add(posting.amount);
      return new DepositAccount(
        account.id,
        new Balance(newLedger, newAvailable),
        account.holds,
        account.status
      );
    }
  }
}

/**
 * Apply multiple postings in sequence.
 * 
 * @param account - The initial account state
 * @param postings - The postings to apply in order
 * @returns The final account state after all postings
 */
export function applyPostings(
  account: DepositAccount,
  postings: Posting[]
): DepositAccount {
  return postings.reduce(
    (acc, posting) => applyPosting(acc, posting),
    account
  );
}

/**
 * Validate that an account state is internally consistent.
 * 
 * @param account - The account to validate
 * @throws Error if any invariant is violated
 */
export function validateAccountState(account: DepositAccount): void {
  // INVARIANT: Available cannot exceed ledger
  if (account.balance.available.isGreaterThan(account.balance.ledger)) {
    throw new Error("AVAILABLE_EXCEEDS_LEDGER");
  }
  
  // INVARIANT: Total holds must equal (ledger - available)
  const totalHolds = account.holds.reduce(
    (sum, hold) => sum.add(hold.amount),
    account.balance.ledger.zero()
  );
  const expectedHolds = account.balance.ledger.subtract(account.balance.available);
  
  if (!totalHolds.equals(expectedHolds)) {
    throw new Error("HOLDS_BALANCE_MISMATCH");
  }
  
  // INVARIANT: No duplicate hold IDs
  const holdIds = new Set(account.holds.map(h => h.id));
  if (holdIds.size !== account.holds.length) {
    throw new Error("DUPLICATE_HOLD_IDS");
  }
}

/**
 * Check if a posting can be applied without actually applying it.
 * 
 * @param account - The current account state
 * @param posting - The posting to check
 * @returns true if the posting can be applied, false otherwise
 */
export function canApplyPosting(
  account: DepositAccount,
  posting: Posting
): boolean {
  try {
    applyPosting(account, posting);
    return true;
  } catch {
    return false;
  }
}
