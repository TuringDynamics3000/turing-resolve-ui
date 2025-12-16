/**
 * Lending Operator UI - Derived Schedule Panel
 * 
 * Shows derived repayment schedule with amortization calculator.
 * CRITICAL: Derived. Not authoritative.
 */

import { Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { calculateAmortizationSchedule } from "../../../../../core/lending/derivation/calculateAmortizationSchedule";

interface DerivedSchedulePanelProps {
  loanId: string;
}

export function DerivedSchedulePanel({ loanId }: DerivedSchedulePanelProps) {
  const { data: facts } = trpc.lending.getFacts.useQuery({ loanId });
  const { data: loan } = trpc.lending.getLoan.useQuery({ loanId });
  
  if (!facts || !loan) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Derived Schedule</h3>
          <span className="text-xs text-amber-400 font-mono">DERIVED. NOT AUTHORITATIVE.</span>
        </div>
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }
  
  const activatedFact = facts.find((f: any) => f.type === "LOAN_ACTIVATED");
  if (!activatedFact) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Derived Schedule</h3>
          <span className="text-xs text-amber-400 font-mono">DERIVED. NOT AUTHORITATIVE.</span>
        </div>
        <p className="text-sm text-slate-400">Loan not yet activated</p>
      </div>
    );
  }
  
  const schedule = calculateAmortizationSchedule(
    loanId,
    BigInt(loan.principal),
    Number(loan.interestRate),
    loan.termMonths,
    facts,
    activatedFact.occurredAt
  );
  
  const formatCurrency = (amount: bigint) => {
    return `$${(Number(amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Derived Schedule</h3>
        <span className="text-xs text-amber-400 font-mono">DERIVED. NOT AUTHORITATIVE.</span>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-900/50 rounded-lg">
        <div>
          <div className="text-xs text-slate-400">Monthly Payment</div>
          <div className="text-lg font-semibold text-white">{formatCurrency(schedule.monthlyPayment)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Total Interest</div>
          <div className="text-lg font-semibold text-amber-400">{formatCurrency(schedule.totalInterest)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Total Payments</div>
          <div className="text-lg font-semibold text-purple-400">{formatCurrency(schedule.totalPayments)}</div>
        </div>
      </div>
      
      {/* Schedule table */}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
            <tr className="text-left text-xs text-slate-400">
              <th className="py-2 px-3">Month</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Payment</th>
              <th className="py-2 px-3">Principal</th>
              <th className="py-2 px-3">Interest</th>
              <th className="py-2 px-3">Remaining</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.entries.map((entry: any) => (
              <tr key={entry.month} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-3 text-slate-300">{entry.month}</td>
                <td className="py-2 px-3 text-slate-400">{entry.paymentDate.toLocaleDateString()}</td>
                <td className="py-2 px-3 text-white font-mono">{formatCurrency(entry.scheduledPayment)}</td>
                <td className="py-2 px-3 text-blue-400 font-mono">{formatCurrency(entry.principalPortion)}</td>
                <td className="py-2 px-3 text-amber-400 font-mono">{formatCurrency(entry.interestPortion)}</td>
                <td className="py-2 px-3 text-slate-300 font-mono">{formatCurrency(entry.remainingPrincipal)}</td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    entry.status === "PAID" ? "bg-green-500/20 text-green-400" :
                    entry.status === "MISSED" ? "bg-red-500/20 text-red-400" :
                    entry.status === "HARDSHIP" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-500/20 text-slate-400"
                  }`}>
                    {entry.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-xs text-slate-500">
        <p>⚠️ This schedule is derived from loan facts and is not authoritative.</p>
        <p>Actual payment obligations are determined by the loan contract and applicable law.</p>
      </div>
    </div>
  );
}
