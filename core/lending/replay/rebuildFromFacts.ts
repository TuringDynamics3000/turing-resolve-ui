/**
 * Lending Core v1 - Deterministic Replay
 * 
 * Rebuild loan state from immutable facts.
 * 
 * Guarantees:
 * - Same facts → same loan state
 * - Invariant enforcement
 * - Order-dependent correctness
 */

import { Loan } from "../aggregate/Loan";
import { LoanFact } from "../events/LoanFact";

/**
 * Rebuild a loan from its fact history.
 * 
 * This is the authoritative way to reconstruct loan state.
 * Used for:
 * - Disaster recovery
 * - Audit verification
 * - Point-in-time queries
 * - State debugging
 */
export function rebuildFromFacts(facts: LoanFact[]): Loan {
  if (facts.length === 0) {
    throw new Error("Cannot rebuild loan from empty fact list");
  }

  // First fact must be LOAN_OFFERED
  const firstFact = facts[0];
  if (firstFact.type !== "LOAN_OFFERED") {
    throw new Error(`First fact must be LOAN_OFFERED, got ${firstFact.type}`);
  }

  // Create initial loan from LOAN_OFFERED fact
  let loan = Loan.fromOfferedFact(firstFact);

  // Apply remaining facts in order
  for (let i = 1; i < facts.length; i++) {
    loan = loan.apply(facts[i]);
  }

  return loan;
}

/**
 * Rebuild loan state as of a specific point in time.
 * 
 * Only applies facts that occurred before the given timestamp.
 */
export function rebuildAsOfDate(facts: LoanFact[], asOfDate: number): Loan {
  const relevantFacts = facts.filter((fact) => fact.occurredAt <= asOfDate);

  if (relevantFacts.length === 0) {
    throw new Error("No facts found before the specified date");
  }

  return rebuildFromFacts(relevantFacts);
}

/**
 * Rebuild loan state up to a specific fact sequence number.
 * 
 * Useful for DR drills and replay verification.
 */
export function rebuildUpToSequence(
  facts: LoanFact[],
  sequenceNumber: number
): Loan {
  const relevantFacts = facts.slice(0, sequenceNumber + 1);

  if (relevantFacts.length === 0) {
    throw new Error("No facts found up to the specified sequence");
  }

  return rebuildFromFacts(relevantFacts);
}
