/**
 * Lending Core - Amortization Schedule Calculator
 * 
 * CRITICAL: This is DERIVED, not authoritative.
 * Schedule is calculated from facts, not stored.
 * 
 * Handles:
 * - Standard amortization (principal + interest)
 * - Hardship periods (payment pause, reduced payments, interest-only)
 * - Restructure (term extension, rate change)
 */

import type { LoanFact } from "../events/LoanFact";

export interface AmortizationScheduleEntry {
  month: number;
  paymentDate: Date;
  scheduledPayment: bigint;
  principalPortion: bigint;
  interestPortion: bigint;
  remainingPrincipal: bigint;
  status: "SCHEDULED" | "PAID" | "MISSED" | "HARDSHIP";
}

export interface AmortizationSchedule {
  loanId: string;
  principal: bigint;
  interestRate: number;
  termMonths: number;
  monthlyPayment: bigint;
  totalInterest: bigint;
  totalPayments: bigint;
  entries: AmortizationScheduleEntry[];
  derived: true; // Always true - this is not authoritative
}

/**
 * Calculate amortization schedule from loan facts
 * 
 * CRITICAL: This is derived, not stored. It's recalculated on demand.
 */
export function calculateAmortizationSchedule(
  loanId: string,
  principal: bigint,
  interestRate: number,
  termMonths: number,
  loanFacts: LoanFact[],
  activatedAt: number
): AmortizationSchedule {
  // Calculate monthly payment using standard amortization formula
  const monthlyPayment = calculateMonthlyPayment(principal, interestRate, termMonths);
  
  // Generate schedule entries
  const entries: AmortizationScheduleEntry[] = [];
  let remainingPrincipal = principal;
  let totalInterest = BigInt(0);
  
  // Track hardship periods
  const hardshipPeriods = extractHardshipPeriods(loanFacts);
  
  // Track payments
  const payments = extractPayments(loanFacts);
  
  for (let month = 1; month <= termMonths; month++) {
    const paymentDate = new Date(activatedAt);
    paymentDate.setMonth(paymentDate.getMonth() + month);
    
    // Check if this month is in hardship
    const inHardship = isInHardship(paymentDate.getTime(), hardshipPeriods);
    
    let scheduledPayment: bigint;
    let principalPortion: bigint;
    let interestPortion: bigint;
    
    if (inHardship) {
      // Hardship: payment pause or reduced payment
      const hardshipType = getHardshipType(paymentDate.getTime(), hardshipPeriods);
      
      if (hardshipType === "PAYMENT_PAUSE") {
        scheduledPayment = BigInt(0);
        principalPortion = BigInt(0);
        interestPortion = BigInt(0);
      } else if (hardshipType === "INTEREST_ONLY") {
        interestPortion = calculateMonthlyInterest(remainingPrincipal, interestRate);
        principalPortion = BigInt(0);
        scheduledPayment = interestPortion;
      } else {
        // REDUCED_PAYMENTS: 50% of normal payment
        scheduledPayment = monthlyPayment / BigInt(2);
        interestPortion = calculateMonthlyInterest(remainingPrincipal, interestRate);
        principalPortion = scheduledPayment - interestPortion;
        if (principalPortion < BigInt(0)) principalPortion = BigInt(0);
      }
    } else {
      // Normal payment
      interestPortion = calculateMonthlyInterest(remainingPrincipal, interestRate);
      principalPortion = monthlyPayment - interestPortion;
      scheduledPayment = monthlyPayment;
    }
    
    // Check if payment was made
    const paymentMade = payments.find(p => 
      p.month === month && p.amount >= scheduledPayment
    );
    
    const status: AmortizationScheduleEntry["status"] = inHardship
      ? "HARDSHIP"
      : paymentMade
      ? "PAID"
      : paymentDate.getTime() < Date.now()
      ? "MISSED"
      : "SCHEDULED";
    
    // Update remaining principal
    if (paymentMade) {
      remainingPrincipal -= principalPortion;
      if (remainingPrincipal < BigInt(0)) remainingPrincipal = BigInt(0);
    }
    
    totalInterest += interestPortion;
    
    entries.push({
      month,
      paymentDate,
      scheduledPayment,
      principalPortion,
      interestPortion,
      remainingPrincipal,
      status,
    });
  }
  
  const totalPayments = principal + totalInterest;
  
  return {
    loanId,
    principal,
    interestRate,
    termMonths,
    monthlyPayment,
    totalInterest,
    totalPayments,
    entries,
    derived: true,
  };
}

/**
 * Calculate monthly payment using standard amortization formula
 * 
 * Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Where:
 * - M = monthly payment
 * - P = principal
 * - r = monthly interest rate
 * - n = number of payments
 */
function calculateMonthlyPayment(
  principal: bigint,
  annualRate: number,
  termMonths: number
): bigint {
  if (annualRate === 0) {
    // No interest: simple division
    return principal / BigInt(termMonths);
  }
  
  const monthlyRate = annualRate / 12;
  const p = Number(principal) / 100; // Convert cents to dollars
  
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  
  const monthlyPaymentDollars = p * (numerator / denominator);
  const monthlyPaymentCents = Math.round(monthlyPaymentDollars * 100);
  
  return BigInt(monthlyPaymentCents);
}

/**
 * Calculate monthly interest on remaining principal
 */
function calculateMonthlyInterest(
  remainingPrincipal: bigint,
  annualRate: number
): bigint {
  const monthlyRate = annualRate / 12;
  const principalDollars = Number(remainingPrincipal) / 100;
  const interestDollars = principalDollars * monthlyRate;
  const interestCents = Math.round(interestDollars * 100);
  
  return BigInt(interestCents);
}

/**
 * Extract hardship periods from loan facts
 */
function extractHardshipPeriods(facts: LoanFact[]): Array<{
  startedAt: number;
  endedAt: number | null;
  hardshipType: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
}> {
  const periods: Array<{
    startedAt: number;
    endedAt: number | null;
    hardshipType: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
  }> = [];
  
  let currentHardship: {
    startedAt: number;
    hardshipType: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
  } | null = null;
  
  for (const fact of facts) {
    if (fact.type === "HARDSHIP_ENTERED") {
      currentHardship = {
        startedAt: fact.occurredAt,
        hardshipType: fact.hardshipType,
      };
    } else if (fact.type === "HARDSHIP_EXITED" && currentHardship) {
      periods.push({
        ...currentHardship,
        endedAt: fact.occurredAt,
      });
      currentHardship = null;
    }
  }
  
  // If hardship is still active
  if (currentHardship) {
    periods.push({
      ...currentHardship,
      endedAt: null,
    });
  }
  
  return periods;
}

/**
 * Extract payments from loan facts
 */
function extractPayments(facts: LoanFact[]): Array<{
  month: number;
  amount: bigint;
  occurredAt: number;
}> {
  const payments: Array<{
    month: number;
    amount: bigint;
    occurredAt: number;
  }> = [];
  
  const activatedFact = facts.find(f => f.type === "LOAN_ACTIVATED");
  if (!activatedFact) return payments;
  
  const activatedAt = activatedFact.occurredAt;
  
  for (const fact of facts) {
    if (fact.type === "LOAN_PAYMENT_APPLIED") {
      const monthsSinceActivation = Math.floor(
        (fact.occurredAt - activatedAt) / (30 * 24 * 60 * 60 * 1000)
      );
      
      payments.push({
        month: monthsSinceActivation + 1,
        amount: fact.amount,
        occurredAt: fact.occurredAt,
      });
    }
  }
  
  return payments;
}

/**
 * Check if date is in hardship period
 */
function isInHardship(
  date: number,
  hardshipPeriods: Array<{
    startedAt: number;
    endedAt: number | null;
    hardshipType: string;
  }>
): boolean {
  return hardshipPeriods.some(
    period =>
      date >= period.startedAt &&
      (period.endedAt === null || date <= period.endedAt)
  );
}

/**
 * Get hardship type for date
 */
function getHardshipType(
  date: number,
  hardshipPeriods: Array<{
    startedAt: number;
    endedAt: number | null;
    hardshipType: "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY";
  }>
): "PAYMENT_PAUSE" | "REDUCED_PAYMENTS" | "INTEREST_ONLY" | null {
  const period = hardshipPeriods.find(
    p =>
      date >= p.startedAt &&
      (p.endedAt === null || date <= p.endedAt)
  );
  
  return period?.hardshipType || null;
}
