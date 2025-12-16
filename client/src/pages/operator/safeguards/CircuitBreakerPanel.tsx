import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle } from "lucide-react";

export function CircuitBreakerPanel() {
  const { data: safeguards, isLoading } = trpc.payments.getSafeguards.useQuery();

  const circuitBreaker = safeguards?.circuitBreaker?.npp;
  const isOpen = circuitBreaker?.state !== "CLOSED";

  if (isLoading) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-32 mb-4" />
        <div className="h-20 bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-amber-400" />
        NPP Circuit Breaker
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Current State</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isOpen 
              ? "bg-red-500/20 text-red-400" 
              : "bg-green-500/20 text-green-400"
          }`}>
            {circuitBreaker?.state || "CLOSED"}
          </span>
        </div>

        {circuitBreaker && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Failure Count</span>
              <span className={`text-lg font-bold ${
                (circuitBreaker.failureCount || 0) > 0 ? "text-amber-400" : "text-green-400"
              }`}>
                {circuitBreaker.failureCount || 0}
              </span>
            </div>
            {circuitBreaker.lastFailure && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Last Failure</span>
                <span className="text-slate-300">
                  {new Date(circuitBreaker.lastFailure).toLocaleString()}
                </span>
              </div>
            )}
          </>
        )}

        {isOpen && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">Circuit Breaker Open</p>
                <p className="text-xs text-red-400/80 mt-1">
                  Too many failures detected. Payments are temporarily blocked to prevent cascade failures.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            Circuit breaker state is managed automatically based on failure thresholds.
            It will reset after the configured timeout period.
          </p>
        </div>
      </div>
    </div>
  );
}
