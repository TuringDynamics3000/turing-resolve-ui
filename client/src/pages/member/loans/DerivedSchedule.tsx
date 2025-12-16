/**
 * Member Loan UI - Derived Schedule
 * 
 * CRITICAL: Derived. Not authoritative. Estimates only.
 * This schedule is calculated from facts and does not move money.
 */

import { trpc } from "@/lib/trpc";

interface DerivedScheduleProps {
  loanId: string;
}

export function DerivedSchedule({ loanId }: DerivedScheduleProps) {
  const { data: schedule } = trpc.lending.getDerivedSchedule.useQuery({ loanId });

  if (!schedule) {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-2">Estimated Repayment Schedule</h2>
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  const formatCurrency = (amount: bigint) => {
    return `$${(Number(amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-white mb-2">Estimated Repayment Schedule</h2>
      <p className="text-sm italic text-amber-400 mb-4">
        Derived. This schedule is an estimate and does not move money.
      </p>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50 border-b border-slate-700">
            <tr className="text-left text-xs text-slate-400">
              <th className="py-2 px-3">Due Date</th>
              <th className="py-2 px-3">Amount</th>
              <th className="py-2 px-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {schedule.entries.map((row: any, i: number) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-3 text-slate-300">
                  {new Date(row.paymentDate).toLocaleDateString()}
                </td>
                <td className="py-2 px-3 text-white font-mono">
                  {formatCurrency(row.scheduledPayment)}
                </td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    row.status === "PAID" ? "bg-green-500/20 text-green-400" :
                    row.status === "MISSED" ? "bg-red-500/20 text-red-400" :
                    row.status === "HARDSHIP" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-500/20 text-slate-400"
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
