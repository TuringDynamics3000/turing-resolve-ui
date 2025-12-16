/**
 * Lending Policy Layer - Arrears Policy v1
 * 
 * CRITICAL RULES:
 * - Policies consume LoanFacts
 * - Policies produce recommended LoanFacts
 * - Policies NEVER apply facts
 * - Policies NEVER mutate state
 * 
 * This replaces HES "collection workflows" but keeps execution
 * deterministic and auditable.
 */

import type { LoanFact } from "../../core/lending";

export interface ArrearsPolicyInput {
  loanId: string;
  loanFacts: LoanFact[];
  currentDate: number; // Unix timestamp
}

export interface ArrearsPolicyRecommendation {
  action: "NO_ACTION" | "ENTER_ARREARS" | "ESCALATE_COLLECTION" | "OFFER_HARDSHIP" | "WRITE_OFF_REVIEW";
  confidence: number; // 0-1
  rationale: string;
  daysPastDue: number;
  amountOverdue: bigint;
  suggestedNextSteps: string[];
}

/**
 * Arrears Policy v1 - Rule-based arrears management
 * 
 * Evaluates:
 * - Days past due (derived from facts)
 * - Amount overdue (derived from facts)
 * - Payment history
 * - Hardship status
 * 
 * Returns: Recommendation only (no execution)
 */
export function evaluateArrearsPolicy(
  input: ArrearsPolicyInput
): ArrearsPolicyRecommendation {
  // Derive days past due and amount overdue from facts
  const { daysPastDue, amountOverdue } = deriveDaysPastDue(input.loanFacts, input.currentDate);
  
  // Check if already in arrears
  const isInArrears = input.loanFacts.some(f => f.type === "LOAN_IN_ARREARS");
  const isInHardship = input.loanFacts.some(
    f => f.type === "HARDSHIP_ENTERED" && !input.loanFacts.some(f2 => f2.type === "HARDSHIP_EXITED" && f2.occurredAt > f.occurredAt)
  );
  
  // Policy rules
  if (daysPastDue === 0) {
    return {
      action: "NO_ACTION",
      confidence: 1.0,
      rationale: "Loan is current. No arrears action required.",
      daysPastDue,
      amountOverdue,
      suggestedNextSteps: [],
    };
  }
  
  if (daysPastDue >= 90) {
    return {
      action: "WRITE_OFF_REVIEW",
      confidence: 0.9,
      rationale: `Loan is ${daysPastDue} days past due. Write-off review recommended.`,
      daysPastDue,
      amountOverdue,
      suggestedNextSteps: [
        "Review borrower contact attempts",
        "Assess collateral recovery options",
        "Prepare write-off justification",
        "Escalate to senior management",
      ],
    };
  }
  
  if (daysPastDue >= 60) {
    return {
      action: "ESCALATE_COLLECTION",
      confidence: 0.85,
      rationale: `Loan is ${daysPastDue} days past due. Escalate to collections team.`,
      daysPastDue,
      amountOverdue,
      suggestedNextSteps: [
        "Contact borrower via phone",
        "Send formal demand letter",
        "Assess hardship eligibility",
        "Consider legal action if no response",
      ],
    };
  }
  
  if (daysPastDue >= 30) {
    if (isInHardship) {
      return {
        action: "NO_ACTION",
        confidence: 0.8,
        rationale: `Loan is ${daysPastDue} days past due but in hardship arrangement. Monitor closely.`,
        daysPastDue,
        amountOverdue,
        suggestedNextSteps: [
          "Review hardship terms",
          "Confirm borrower compliance with hardship arrangement",
        ],
      };
    }
    
    return {
      action: "OFFER_HARDSHIP",
      confidence: 0.75,
      rationale: `Loan is ${daysPastDue} days past due. Offer hardship arrangement to prevent further delinquency.`,
      daysPastDue,
      amountOverdue,
      suggestedNextSteps: [
        "Contact borrower to discuss hardship options",
        "Assess financial situation",
        "Offer payment pause or reduced payments",
      ],
    };
  }
  
  if (daysPastDue >= 7 && !isInArrears) {
    return {
      action: "ENTER_ARREARS",
      confidence: 0.9,
      rationale: `Loan is ${daysPastDue} days past due. Enter arrears status.`,
      daysPastDue,
      amountOverdue,
      suggestedNextSteps: [
        "Send arrears notice to borrower",
        "Attempt contact via phone/email",
        "Monitor for payment",
      ],
    };
  }
  
  return {
    action: "NO_ACTION",
    confidence: 0.7,
    rationale: `Loan is ${daysPastDue} days past due. Monitor for payment.`,
    daysPastDue,
    amountOverdue,
    suggestedNextSteps: [
      "Send payment reminder",
      "Monitor for next 7 days",
    ],
  };
}

/**
 * Derive days past due and amount overdue from loan facts
 * 
 * CRITICAL: This is derived, not stored.
 */
function deriveDaysPastDue(
  loanFacts: LoanFact[],
  currentDate: number
): {
  daysPastDue: number;
  amountOverdue: bigint;
} {
  // Find loan activation date
  const activatedFact = loanFacts.find(f => f.type === "LOAN_ACTIVATED");
  if (!activatedFact || activatedFact.type !== "LOAN_ACTIVATED") {
    return { daysPastDue: 0, amountOverdue: 0n };
  }
  
  // Find loan terms
  const offeredFact = loanFacts.find(f => f.type === "LOAN_OFFERED");
  if (!offeredFact || offeredFact.type !== "LOAN_OFFERED") {
    return { daysPastDue: 0, amountOverdue: 0n };
  }
  
  // Calculate expected payment date (simplified: 30 days from activation)
  const expectedPaymentDate = activatedFact.occurredAt + (30 * 24 * 60 * 60 * 1000);
  
  // Check if payment was made
  const paymentFacts = loanFacts.filter(f => f.type === "LOAN_PAYMENT_APPLIED");
  const lastPayment = paymentFacts[paymentFacts.length - 1];
  
  if (lastPayment && lastPayment.occurredAt >= expectedPaymentDate) {
    // Payment made on time
    return { daysPastDue: 0, amountOverdue: 0n };
  }
  
  // Calculate days past due
  if (currentDate < expectedPaymentDate) {
    // Not yet due
    return { daysPastDue: 0, amountOverdue: 0n };
  }
  
  const daysPastDue = Math.floor((currentDate - expectedPaymentDate) / (24 * 60 * 60 * 1000));
  
  // Calculate amount overdue (simplified: monthly payment amount)
  const monthlyPayment = calculateMonthlyPayment(offeredFact.principal, offeredFact.interestRate, offeredFact.termMonths);
  
  return {
    daysPastDue,
    amountOverdue: monthlyPayment,
  };
}

/**
 * Calculate monthly payment (simplified amortization)
 */
function calculateMonthlyPayment(principal: bigint, annualRate: number, termMonths: number): bigint {
  const monthlyRate = annualRate / 12;
  const n = termMonths;
  const p = Number(principal);
  
  if (monthlyRate === 0) {
    return BigInt(Math.floor(p / n));
  }
  
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, n);
  const denominator = Math.pow(1 + monthlyRate, n) - 1;
  const payment = p * (numerator / denominator);
  
  return BigInt(Math.floor(payment));
}
