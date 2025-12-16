/**
 * Lending Core v1 - Loan State
 * 
 * Authoritative loan lifecycle states.
 * All transitions are explicit and fact-driven.
 */

export type LoanState =
  | "OFFERED"      // Loan offered to borrower, not yet accepted
  | "ACTIVE"       // Loan accepted and activated, in good standing
  | "IN_ARREARS"   // Loan has missed payments, not yet default
  | "HARDSHIP"     // Borrower in hardship arrangement
  | "DEFAULT"      // Loan defaulted, legal action may follow
  | "CLOSED"       // Loan fully repaid and closed
  | "WRITTEN_OFF"; // Loan written off, no longer collectible

/**
 * Legal state transitions (enforced by invariants)
 * 
 * OFFERED → ACTIVE (loan accepted and activated)
 * ACTIVE → IN_ARREARS (missed payment)
 * ACTIVE → HARDSHIP (hardship entered)
 * ACTIVE → CLOSED (fully repaid)
 * IN_ARREARS → ACTIVE (arrears cleared)
 * IN_ARREARS → HARDSHIP (hardship entered)
 * IN_ARREARS → DEFAULT (default declared)
 * HARDSHIP → ACTIVE (hardship exited, back to good standing)
 * HARDSHIP → IN_ARREARS (hardship exited, still in arrears)
 * DEFAULT → WRITTEN_OFF (write-off approved)
 * 
 * Illegal transitions throw LoanInvariantViolation
 */
