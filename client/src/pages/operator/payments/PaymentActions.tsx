import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { 
  RefreshCw, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";

interface PaymentActionsProps {
  paymentId: string;
  currentState: string;
}

export function PaymentActions({ paymentId, currentState }: PaymentActionsProps) {
  const [retryReason, setRetryReason] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [showRetryForm, setShowRetryForm] = useState(false);
  const [showReverseForm, setShowReverseForm] = useState(false);

  const utils = trpc.useUtils();

  const retryMutation = trpc.payments.operatorRetry.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setShowRetryForm(false);
        setRetryReason("");
        utils.payments.rebuildFromFacts.invalidate({ paymentId });
        utils.payments.getFacts.invalidate({ paymentId });
      }
    },
  });

  const reverseMutation = trpc.payments.operatorReverse.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setShowReverseForm(false);
        setReverseReason("");
        utils.payments.rebuildFromFacts.invalidate({ paymentId });
        utils.payments.getFacts.invalidate({ paymentId });
      }
    },
  });

  const canRetry = currentState === "FAILED" || currentState === "HELD";
  const canReverse = currentState === "SETTLED";

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        Operator Actions
      </h3>

      <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-300">
          <strong>Important:</strong> Actions emit commands only. UI does not assume success.
          Outcome is determined by fact replay.
        </p>
      </div>

      <div className="flex gap-4">
        {/* Retry Button */}
        <div className="flex-1">
          {!showRetryForm ? (
            <button
              onClick={() => setShowRetryForm(true)}
              disabled={!canRetry}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                canRetry
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <RefreshCw className="w-5 h-5" />
              Retry Payment
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={retryReason}
                onChange={(e) => setRetryReason(e.target.value)}
                placeholder="Reason for retry (required)..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (retryReason.trim()) {
                      retryMutation.mutate({ paymentId, reason: retryReason });
                    }
                  }}
                  disabled={!retryReason.trim() || retryMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm Retry
                </button>
                <button
                  onClick={() => {
                    setShowRetryForm(false);
                    setRetryReason("");
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!canRetry && !showRetryForm && (
            <p className="text-xs text-slate-500 mt-2">
              Only FAILED or HELD payments can be retried
            </p>
          )}
        </div>

        {/* Reverse Button */}
        <div className="flex-1">
          {!showReverseForm ? (
            <button
              onClick={() => setShowReverseForm(true)}
              disabled={!canReverse}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                canReverse
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              Reverse Payment
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Reason for reversal (required)..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (reverseReason.trim()) {
                      reverseMutation.mutate({ paymentId, reason: reverseReason });
                    }
                  }}
                  disabled={!reverseReason.trim() || reverseMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  {reverseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm Reversal
                </button>
                <button
                  onClick={() => {
                    setShowReverseForm(false);
                    setReverseReason("");
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!canReverse && !showReverseForm && (
            <p className="text-xs text-slate-500 mt-2">
              Only SETTLED payments can be reversed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
