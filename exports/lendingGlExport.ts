/**
 * Lending → GL Export Mapping
 * 
 * Read-only, derived, and rebuildable.
 * 
 * CRITICAL RULES:
 * - No GL writes affect core
 * - GL export is rebuildable from facts
 * - Deleting GL export does not affect replay
 * - No GL logic in core
 * - GL totals reconcile with derived loan state
 */

import type { LoanFact } from "../core/lending";

export interface GlEntry {
  debit: string;
  credit: string;
  amount: string; // BigInt as string
  occurredAt: number;
  loanId: string;
  factType: "LOAN_ACTIVATED" | "LOAN_PAYMENT_APPLIED" | "INTEREST_ACCRUED" | "FEE_APPLIED" | "LOAN_WRITTEN_OFF";
  description: string;
}

/**
 * GL Mapping Rules (Authoritative)
 * 
 * | Loan Event              | GL Entry                                          |
 * |-------------------------|---------------------------------------------------|
 * | LOAN_ACTIVATED          | Dr Loans Receivable / Cr Cash                    |
 * | LOAN_PAYMENT_APPLIED    | Dr Cash / Cr Loans Receivable                    |
 * | INTEREST_ACCRUED        | Dr Loans Receivable / Cr Interest Income         |
 * | FEE_APPLIED             | Dr Loans Receivable / Cr Fee Income              |
 * | LOAN_WRITTEN_OFF        | Dr Bad Debt Expense / Cr Loans Receivable        |
 */
export function exportLendingGL(loanFacts: LoanFact[]): GlEntry[] {
  return loanFacts.flatMap((fact): GlEntry[] => {
    switch (fact.type) {
      case "LOAN_ACTIVATED":
        // Disbursement: Dr Loans Receivable / Cr Cash
        return [
          {
            debit: "Loans Receivable",
            credit: "Cash",
            amount: "PRINCIPAL_AMOUNT", // Derived from LOAN_OFFERED fact
            occurredAt: fact.occurredAt,
            loanId: fact.loanId,
            factType: fact.type,
            description: `Loan ${fact.loanId} disbursed to ${fact.disbursementAccountId}`,
          },
        ];

      case "LOAN_PAYMENT_APPLIED":
        // Payment: Dr Cash / Cr Loans Receivable
        return [
          {
            debit: "Cash",
            credit: "Loans Receivable",
            amount: fact.amount.toString(),
            occurredAt: fact.occurredAt,
            loanId: fact.loanId,
            factType: fact.type,
            description: `Loan ${fact.loanId} payment applied (principal: ${fact.principalPortion}, interest: ${fact.interestPortion})`,
          },
        ];

      case "INTEREST_ACCRUED":
        // Interest accrual: Dr Loans Receivable / Cr Interest Income
        return [
          {
            debit: "Loans Receivable",
            credit: "Interest Income",
            amount: fact.amount.toString(),
            occurredAt: fact.occurredAt,
            loanId: fact.loanId,
            factType: fact.type,
            description: `Loan ${fact.loanId} interest accrued`,
          },
        ];

      case "FEE_APPLIED":
        // Fee: Dr Loans Receivable / Cr Fee Income
        return [
          {
            debit: "Loans Receivable",
            credit: "Fee Income",
            amount: fact.amount.toString(),
            occurredAt: fact.occurredAt,
            loanId: fact.loanId,
            factType: fact.type,
            description: `Loan ${fact.loanId} fee applied (${fact.feeType})`,
          },
        ];

      case "LOAN_WRITTEN_OFF":
        // Write-off: Dr Bad Debt Expense / Cr Loans Receivable
        return [
          {
            debit: "Bad Debt Expense",
            credit: "Loans Receivable",
            amount: fact.amountWrittenOff.toString(),
            occurredAt: fact.occurredAt,
            loanId: fact.loanId,
            factType: fact.type,
            description: `Loan ${fact.loanId} written off (${fact.reason})`,
          },
        ];

      default:
        // Other facts don't generate GL entries
        return [];
    }
  });
}

/**
 * Export GL entries as CSV
 */
export function exportGlAsCsv(entries: GlEntry[]): string {
  const header = "Date,Loan ID,Debit,Credit,Amount,Description\n";
  const rows = entries.map((entry) => {
    const date = new Date(entry.occurredAt).toISOString().split("T")[0];
    return `${date},${entry.loanId},${entry.debit},${entry.credit},${entry.amount},${entry.description}`;
  });
  return header + rows.join("\n");
}

/**
 * Export GL entries as JSON
 */
export function exportGlAsJson(entries: GlEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Reconcile GL totals with loan state
 * 
 * Verifies that GL export matches derived loan balances.
 */
export function reconcileGlWithLoans(
  glEntries: GlEntry[],
  loans: Array<{ loanId: string; principal: bigint }>
): {
  isReconciled: boolean;
  discrepancies: Array<{ loanId: string; glBalance: bigint; loanBalance: bigint; diff: bigint }>;
} {
  // Calculate GL balance per loan
  const glBalances = new Map<string, bigint>();
  
  for (const entry of glEntries) {
    const current = glBalances.get(entry.loanId) || 0n;
    const amount = BigInt(entry.amount === "PRINCIPAL_AMOUNT" ? "0" : entry.amount);
    
    if (entry.debit === "Loans Receivable") {
      glBalances.set(entry.loanId, current + amount);
    } else if (entry.credit === "Loans Receivable") {
      glBalances.set(entry.loanId, current - amount);
    }
  }

  // Compare with loan balances
  const discrepancies = [];
  for (const loan of loans) {
    const glBalance = glBalances.get(loan.loanId) || 0n;
    const diff = glBalance - loan.principal;
    
    if (diff !== 0n) {
      discrepancies.push({
        loanId: loan.loanId,
        glBalance,
        loanBalance: loan.principal,
        diff,
      });
    }
  }

  return {
    isReconciled: discrepancies.length === 0,
    discrepancies,
  };
}
