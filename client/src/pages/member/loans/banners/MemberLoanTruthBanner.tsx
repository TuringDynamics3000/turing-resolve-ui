/**
 * Member Loan UI - Truth Surface Banner
 * 
 * CRITICAL: This banner explains that the member UI is read-only.
 * It cannot initiate actions, only display confirmed state.
 */

export function MemberLoanTruthBanner() {
  return (
    <div className="border border-slate-700 bg-slate-800/30 p-4 mb-6 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-2">Loan Status</h3>
      <p className="text-sm text-slate-400">
        This view shows confirmed system state derived from immutable records.
        Schedules are estimates; payments only affect your loan after settlement.
      </p>
    </div>
  );
}
