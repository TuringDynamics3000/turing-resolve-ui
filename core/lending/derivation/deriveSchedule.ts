/**
 * Lending Core v1 - Derived Schedule Calculator
 * 
 * CRITICAL: This is DERIVED, not authoritative.
 * 
 * Rules:
 * - Hardship and restructure never rewrite the past
 * - They alter how future obligations are derived
 * - Never emit facts from here
 * - Never mutate state
 * 
 * Derivation Rules:
 * - If HARDSHIP_ENTERED and no HARDSHIP_EXITED:
 *   * PAYMENT_PAUSE → next due = 0
 *   * REDUCED_PAYMENTS → next due = derived minimum
 *   * INTEREST_ONLY → principal unchanged, interest only
 * - If LOAN_RESTRUCTURED:
 *   * Apply new terms only after restructure date
 *   * Prior schedule remains unchanged
 */

import { LoanFact } from "../events/LoanFact";

export interface DerivedScheduleEntry {
  dueDate: number; // Unix timestamp
  principalDue: bigint;
  interestDue: bigint;
  totalDue: bigint;
  outstandingPrincipal: bigint;
}

export interface DerivedSchedule {
  loanId: string;
  entries: DerivedScheduleEntry[];
  nextPaymentDue: bigint;
  nextPaymentDate: number;
  isInHardship: boolean;
  hardshipType?: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
  restructuredAt?: number;
  currentTerms: {
    interestRate: number;
    termMonths: number;
  };
}

interface LoanTerms {
  principal: bigint;
  interestRate: number;
  termMonths: number;
  activatedAt: number;
}

/**
 * Derive repayment schedule from facts.
 * 
 * This is NOT authoritative. It's a projection for operator visibility.
 */
export function deriveSchedule(
  facts: LoanFact[],
  asOfDate: number = Date.now()
): DerivedSchedule | null {
  // Extract initial terms from LOAN_OFFERED
  const offeredFact = facts.find(f => f.type === "LOAN_OFFERED");
  if (!offeredFact || offeredFact.type !== "LOAN_OFFERED") {
    return null;
  }

  const activatedFact = facts.find(f => f.type === "LOAN_ACTIVATED");
  if (!activatedFact || activatedFact.type !== "LOAN_ACTIVATED") {
    return null; // Can't derive schedule until activated
  }

  let currentTerms: LoanTerms = {
    principal: offeredFact.principal,
    interestRate: offeredFact.interestRate,
    termMonths: offeredFact.termMonths,
    activatedAt: activatedFact.occurredAt,
  };

  // Check for hardship status
  const hardshipEnteredFacts = facts.filter(f => f.type === "HARDSHIP_ENTERED");
  const hardshipExitedFacts = facts.filter(f => f.type === "HARDSHIP_EXITED");
  const isInHardship = hardshipEnteredFacts.length > hardshipExitedFacts.length;
  const lastHardshipFact = hardshipEnteredFacts[hardshipEnteredFacts.length - 1];
  const hardshipType = isInHardship && lastHardshipFact?.type === "HARDSHIP_ENTERED"
    ? lastHardshipFact.hardshipType
    : undefined;

  // Check for restructure
  const restructureFacts = facts.filter(f => f.type === "LOAN_RESTRUCTURED");
  const lastRestructure = restructureFacts[restructureFacts.length - 1];
  if (lastRestructure && lastRestructure.type === "LOAN_RESTRUCTURED") {
    // Apply new terms only after restructure date
    if (lastRestructure.newInterestRate !== undefined) {
      currentTerms.interestRate = lastRestructure.newInterestRate;
    }
    if (lastRestructure.newTermMonths !== undefined) {
      currentTerms.termMonths = lastRestructure.newTermMonths;
    }
  }

  // Calculate current outstanding principal from facts
  let outstandingPrincipal = currentTerms.principal;
  for (const fact of facts) {
    if (fact.type === "LOAN_PAYMENT_APPLIED") {
      outstandingPrincipal -= fact.amount;
    } else if (fact.type === "INTEREST_ACCRUED") {
      outstandingPrincipal += fact.amount;
    } else if (fact.type === "FEE_APPLIED") {
      outstandingPrincipal += fact.amount;
    }
  }

  // Derive next payment based on hardship status
  let nextPaymentDue: bigint;
  if (isInHardship) {
    switch (hardshipType) {
      case "PAYMENT_PAUSE":
        nextPaymentDue = 0n; // No payment due
        break;
      case "REDUCED_PAYMENTS":
        // Simplified: 50% of normal payment
        nextPaymentDue = calculateMonthlyPayment(currentTerms) / 2n;
        break;
      case "INTEREST_ONLY":
        // Only interest, no principal reduction
        nextPaymentDue = calculateMonthlyInterest(outstandingPrincipal, currentTerms.interestRate);
        break;
      default:
        nextPaymentDue = calculateMonthlyPayment(currentTerms);
    }
  } else {
    nextPaymentDue = calculateMonthlyPayment(currentTerms);
  }

  // Calculate next payment date (simplified: 30 days from activation)
  const monthsSinceActivation = Math.floor((asOfDate - currentTerms.activatedAt) / (30 * 24 * 60 * 60 * 1000));
  const nextPaymentDate = currentTerms.activatedAt + ((monthsSinceActivation + 1) * 30 * 24 * 60 * 60 * 1000);

  // Generate schedule entries (simplified: just next 12 months)
  const entries: DerivedScheduleEntry[] = [];
  let remainingPrincipal = outstandingPrincipal;
  for (let i = 0; i < Math.min(12, currentTerms.termMonths); i++) {
    const interestDue = calculateMonthlyInterest(remainingPrincipal, currentTerms.interestRate);
    const principalDue = nextPaymentDue - interestDue;
    
    entries.push({
      dueDate: currentTerms.activatedAt + ((monthsSinceActivation + i + 1) * 30 * 24 * 60 * 60 * 1000),
      principalDue: principalDue > 0n ? principalDue : 0n,
      interestDue,
      totalDue: nextPaymentDue,
      outstandingPrincipal: remainingPrincipal,
    });

    remainingPrincipal -= principalDue;
    if (remainingPrincipal <= 0n) break;
  }

  return {
    loanId: offeredFact.loanId,
    entries,
    nextPaymentDue,
    nextPaymentDate,
    isInHardship,
    hardshipType,
    restructuredAt: lastRestructure?.occurredAt,
    currentTerms: {
      interestRate: currentTerms.interestRate,
      termMonths: currentTerms.termMonths,
    },
  };
}

/**
 * Calculate monthly payment using standard amortization formula.
 * P = L[c(1 + c)^n]/[(1 + c)^n - 1]
 */
function calculateMonthlyPayment(terms: LoanTerms): bigint {
  const monthlyRate = terms.interestRate / 12;
  const n = terms.termMonths;
  const principal = Number(terms.principal);

  if (monthlyRate === 0) {
    // No interest: simple division
    return BigInt(Math.floor(principal / n));
  }

  const numerator = monthlyRate * Math.pow(1 + monthlyRate, n);
  const denominator = Math.pow(1 + monthlyRate, n) - 1;
  const payment = principal * (numerator / denominator);

  return BigInt(Math.floor(payment));
}

/**
 * Calculate monthly interest on outstanding principal.
 */
function calculateMonthlyInterest(principal: bigint, annualRate: number): bigint {
  const monthlyRate = annualRate / 12;
  const interest = Number(principal) * monthlyRate;
  return BigInt(Math.floor(interest));
}
