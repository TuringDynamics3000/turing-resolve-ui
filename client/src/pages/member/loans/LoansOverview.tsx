/**
 * Member Loan UI - Loans Overview
 * 
 * CRITICAL: Read-only. No mutations. No action buttons.
 * All state rendered from replay of immutable facts.
 */

import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MemberLoanTruthBanner } from "./banners/MemberLoanTruthBanner";

export function LoansOverview() {
  const { data: loans } = trpc.lending.listLoans.useQuery();

  if (!loans) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Your Loans</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  const formatCurrency = (amount: string | bigint) => {
    const num = typeof amount === 'bigint' ? Number(amount) : Number(amount);
    return `$${(num / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {state}
      </span>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Your Loans</h1>

      <MemberLoanTruthBanner />

      {loans.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400">You have no loans.</p>
        </div>
      ) : (
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr className="text-left text-xs text-slate-400">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Principal</th>
                <th className="py-3 px-4">Last Update</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan: any) => (
                <tr key={loan.loanId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-3 px-4 text-sm text-slate-300 font-mono">{loan.loanId.slice(0, 8)}...</td>
                  <td className="py-3 px-4">{getStatusBadge(loan.state)}</td>
                  <td className="py-3 px-4 text-sm text-white font-mono">{formatCurrency(loan.principal)}</td>
                  <td className="py-3 px-4 text-sm text-slate-400">{formatDate(loan.lastFactAt)}</td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/member/loans/${loan.loanId}`}>
                      <a className="text-sm text-blue-400 hover:text-blue-300">View Details</a>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
