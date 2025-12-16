import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { PaymentActions } from "./PaymentActions";
import { AdvisoryPanel } from "../advisory/AdvisoryPanel";
import { AdvisoryBanner } from "../banners/AdvisoryBanner";
import { 
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Hash,
  FileText
} from "lucide-react";
import { Link } from "wouter";

const stateColors: Record<string, { bg: string; text: string }> = {
  INITIATED: { bg: "bg-amber-500/20", text: "text-amber-400" },
  HELD: { bg: "bg-amber-500/20", text: "text-amber-400" },
  SENT: { bg: "bg-blue-500/20", text: "text-blue-400" },
  SETTLED: { bg: "bg-green-500/20", text: "text-green-400" },
  FAILED: { bg: "bg-red-500/20", text: "text-red-400" },
  REVERSED: { bg: "bg-red-500/20", text: "text-red-400" },
};

export function PaymentDetail() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId || "";

  const { data: paymentData, isLoading: paymentLoading } = trpc.payments.rebuildFromFacts.useQuery(
    { paymentId },
    { enabled: !!paymentId }
  );
  const { data: facts, isLoading: factsLoading } = trpc.payments.getFacts.useQuery(
    { paymentId },
    { enabled: !!paymentId }
  );

  if (paymentLoading || factsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="h-64 bg-slate-800 rounded" />
      </div>
    );
  }

  if (!paymentData?.success || !paymentData.payment) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Payment Not Found</h2>
        <p className="text-slate-400">{paymentData?.error || "Unable to load payment details"}</p>
        <Link href="/operator/payments">
          <a className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
            <ArrowLeft className="w-4 h-4" />
            Back to Payments
          </a>
        </Link>
      </div>
    );
  }

  const payment = paymentData.payment;
  const stateStyle = stateColors[payment.currentState] || stateColors.INITIATED;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/operator/payments">
            <a className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </a>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white">Payment {paymentId}</h2>
            <p className="text-sm text-slate-400">Operator Control View</p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-lg text-lg font-semibold ${stateStyle.bg} ${stateStyle.text}`}>
          {payment.currentState}
        </span>
      </div>

      <AdvisoryBanner />

      {/* Intent Summary */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Intent Summary
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-400">From Account</div>
            <code className="text-blue-400 font-mono">{payment.intent.fromAccount}</code>
          </div>
          <div>
            <div className="text-sm text-slate-400">To Account</div>
            <code className="text-blue-400 font-mono">
              {payment.intent.toAccount || JSON.stringify(payment.intent.toExternal) || "External"}
            </code>
          </div>
          <div>
            <div className="text-sm text-slate-400">Amount</div>
            <div className="text-white font-medium">
              ${parseFloat(payment.intent.amount).toFixed(2)} {payment.intent.currency}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Scheme</div>
            <span className={`px-2 py-0.5 rounded text-xs ${
              payment.intent.scheme === "NPP" ? "bg-purple-500/20 text-purple-400" : "bg-slate-600/50 text-slate-300"
            }`}>
              {payment.intent.scheme}
            </span>
          </div>
          <div className="col-span-2">
            <div className="text-sm text-slate-400">Idempotency Key</div>
            <code className="text-xs text-slate-500 font-mono">{payment.intent.idempotencyKey}</code>
          </div>
        </div>
      </div>

      {/* State Transitions */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          State Transitions (Replayed from Facts)
        </h3>
        <div className="space-y-2">
          {payment.stateTransitions.map((transition, idx) => (
            <div key={idx} className="flex items-center gap-4 text-sm">
              <span className="text-slate-500 w-24">{transition.occurredAt ? new Date(transition.occurredAt).toLocaleTimeString() : "—"}</span>
              <span className="text-slate-400">{transition.from}</span>
              <span className="text-slate-500">→</span>
              <span className="text-white font-medium">{transition.to}</span>
              <span className="text-xs text-slate-500">({transition.factType})</span>
            </div>
          ))}
          {payment.stateTransitions.length === 0 && (
            <div className="text-slate-500">No state transitions recorded</div>
          )}
        </div>
      </div>

      {/* Fact Timeline */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Fact Timeline
        </h3>
        <div className="space-y-3">
          {facts?.map((fact, idx) => (
            <div key={idx} className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-500 w-20 pt-0.5">
                {new Date(fact.occurredAt).toLocaleTimeString()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{fact.factType}</span>
                  <span className="text-xs text-slate-500">seq: {fact.sequence}</span>
                </div>
                {fact.depositPostingType && (
                  <div className="text-xs text-slate-400 mt-1">
                    Deposit: {fact.depositPostingType}
                  </div>
                )}
              </div>
              <Hash className="w-4 h-4 text-slate-600" />
            </div>
          ))}
          {(!facts || facts.length === 0) && (
            <div className="text-slate-500">No facts recorded</div>
          )}
        </div>
      </div>

      {/* Operator Actions */}
      <PaymentActions paymentId={paymentId} currentState={payment.currentState} />

      {/* Advisory Panel */}
      <AdvisoryPanel entityType="PAYMENT" entityId={paymentId} />
    </div>
  );
}
