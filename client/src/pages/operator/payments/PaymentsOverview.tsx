import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  ChevronRight
} from "lucide-react";

const stateColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  INITIATED: { bg: "bg-amber-500/20", text: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
  HELD: { bg: "bg-amber-500/20", text: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
  SENT: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <RefreshCw className="w-4 h-4" /> },
  SETTLED: { bg: "bg-green-500/20", text: "text-green-400", icon: <CheckCircle2 className="w-4 h-4" /> },
  FAILED: { bg: "bg-red-500/20", text: "text-red-400", icon: <XCircle className="w-4 h-4" /> },
  REVERSED: { bg: "bg-red-500/20", text: "text-red-400", icon: <XCircle className="w-4 h-4" /> },
};

export function PaymentsOverview() {
  const { data: payments, isLoading, refetch } = trpc.payments.listCoreV1.useQuery();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="h-64 bg-slate-800 rounded" />
      </div>
    );
  }

  const summary = {
    total: payments?.length || 0,
    settled: payments?.filter(p => p.state === "SETTLED").length || 0,
    inProgress: payments?.filter(p => ["INITIATED", "HELD", "SENT"].includes(p.state)).length || 0,
    failed: payments?.filter(p => ["FAILED", "REVERSED"].includes(p.state)).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-blue-400" />
          Payments — Operator View
        </h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400">Total Payments</div>
          <div className="text-2xl font-bold text-white">{summary.total}</div>
        </div>
        <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4">
          <div className="text-sm text-green-400">Settled</div>
          <div className="text-2xl font-bold text-green-300">{summary.settled}</div>
        </div>
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-4">
          <div className="text-sm text-amber-400">In Progress</div>
          <div className="text-2xl font-bold text-amber-300">{summary.inProgress}</div>
        </div>
        <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4">
          <div className="text-sm text-red-400">Failed/Reversed</div>
          <div className="text-2xl font-bold text-red-300">{summary.failed}</div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Payment ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">State</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Scheme</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">From → To</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Facts</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Last Event</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {payments?.map((payment) => {
              const stateStyle = stateColors[payment.state] || stateColors.INITIATED;
              return (
                <tr key={payment.paymentId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-sm text-blue-400 font-mono">{payment.paymentId}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${stateStyle.bg} ${stateStyle.text}`}>
                      {stateStyle.icon}
                      {payment.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">
                    ${parseFloat(payment.amount).toFixed(2)} {payment.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      payment.scheme === "NPP" ? "bg-purple-500/20 text-purple-400" : "bg-slate-600/50 text-slate-300"
                    }`}>
                      {payment.scheme}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    <span className="font-mono text-xs">{payment.fromAccount?.slice(0, 8)}...</span>
                    <span className="mx-2 text-slate-500">→</span>
                    <span className="font-mono text-xs">
                      {payment.toAccount?.slice(0, 8) || "External"}...
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400">{payment.factCount}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {payment.lastEvent || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/operator/payments/${payment.paymentId}`}>
                      <a className="text-blue-400 hover:text-blue-300 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </a>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {(!payments || payments.length === 0) && (
          <div className="p-8 text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No payments found
          </div>
        )}
      </div>
    </div>
  );
}
