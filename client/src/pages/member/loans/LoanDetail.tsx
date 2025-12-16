/**
 * Member Loan UI - Loan Detail
 * 
 * CRITICAL: Read-only. No mutations. No action buttons.
 * All state rendered from replay of immutable facts.
 */

import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MemberLoanTruthBanner } from "./banners/MemberLoanTruthBanner";
import { DerivedSchedule } from "./DerivedSchedule";

export function LoanDetail() {
  const params = useParams();
  const loanId = params.loanId || "";
  
  const { data: loan } = trpc.lending.getLoan.useQuery({ loanId });
  const { data: facts } = trpc.lending.getFacts.useQuery({ loanId });

  if (!loan || !facts) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Loan Details</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  const formatCurrency = (amount: string | bigint) => {
    const num = typeof amount === 'bigint' ? Number(amount) : Number(amount);
    return `$${(num / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusMessage = (state: string) => {
    const messages: Record<string, string> = {
      OFFERED: "Loan offer pending acceptance.",
      ACCEPTED: "Loan accepted, pending activation.",
      ACTIVE: "Loan is active.",
      IN_ARREARS: "This reflects missed obligations. No additional fees are applied unless confirmed.",
      HARDSHIP: "Your loan is under an approved hardship arrangement.",
      DEFAULT: "Loan is in default.",
      CLOSED: "Your loan is fully repaid.",
      WRITTEN_OFF: "Loan closed following write-off.",
    };
    return messages[state] || "Loan status unknown.";
  };

  const getStatusBadge = (state: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      OFFERED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      ACCEPTED: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
      ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400' },
      IN_ARREARS: { bg: 'bg-red-500/20', text: 'text-red-400' },
      HARDSHIP: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
      DEFAULT: { bg: 'bg-red-700/20', text: 'text-red-400' },
      CLOSED: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
      WRITTEN_OFF: { bg: 'bg-slate-700/20', text: 'text-slate-500' },
    };

    const badge = badges[state] || badges.ACTIVE;
    return (
      <span className={`px-3 py-1 rounded text-sm font-medium ${badge.bg} ${badge.text}`}>
        {state}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/member/loans">
          <a className="text-sm text-blue-400 hover:text-blue-300">← Back to Loans</a>
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">Loan {loanId.slice(0, 8)}...</h1>

      <MemberLoanTruthBanner />

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              {getStatusBadge(loan.state)}
            </div>
            <p className="text-sm text-slate-400 mt-2">{getStatusMessage(loan.state)}</p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-1">Principal</p>
            <p className="text-2xl font-bold text-white font-mono">{formatCurrency(loan.principal)}</p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-1">Interest Rate</p>
            <p className="text-lg text-white">{loan.interestRate}% APR</p>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-1">Term</p>
            <p className="text-lg text-white">{loan.termMonths} months</p>
          </div>
        </div>
      </div>

      <DerivedSchedule loanId={loanId} />

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Loan History</h2>
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
          <div className="space-y-3">
            {facts.map((fact: any, i: number) => (
              <div key={i} className="border-l-2 border-slate-600 pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{fact.type}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(fact.occurredAt).toLocaleString()}
                  </span>
                </div>
                <pre className="text-xs text-slate-500 mt-1 overflow-x-auto">
                  {JSON.stringify(fact, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
