import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, DollarSign, AlertTriangle } from "lucide-react";

const domainIcons: Record<string, any> = {
  PAYMENTS_RL: TrendingUp,
  FRAUD: Shield,
  AML: AlertTriangle,
  TREASURY: DollarSign,
};

const domainColors: Record<string, string> = {
  PAYMENTS_RL: "text-blue-400",
  FRAUD: "text-red-400",
  AML: "text-amber-400",
  TREASURY: "text-green-400",
};

const recommendationColors: Record<string, { bg: string; text: string }> = {
  APPROVE: { bg: "bg-green-500/20", text: "text-green-400" },
  DECLINE: { bg: "bg-red-500/20", text: "text-red-400" },
  REVIEW: { bg: "bg-amber-500/20", text: "text-amber-400" },
  HOLD: { bg: "bg-orange-500/20", text: "text-orange-400" },
};

interface ShadowAIAdvisoryCardProps {
  paymentId: string;
}

export function ShadowAIAdvisoryCard({ paymentId }: ShadowAIAdvisoryCardProps) {
  const { data: advisories, isLoading } = trpc.shadowAI.getForEntity.useQuery({
    entityType: "PAYMENT",
    entityId: paymentId,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Shadow AI Advisory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-slate-800 rounded" />
            <div className="h-16 bg-slate-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!advisories || advisories.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Shadow AI Advisory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            No Shadow AI advisories for this payment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          Shadow AI Advisory
        </CardTitle>
        <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <p className="text-xs text-purple-300">
            <strong>Shadow Mode:</strong> These AI recommendations are logged for audit and board packs only. They do NOT execute or override system decisions.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {advisories.map((advisory) => {
          const DomainIcon = domainIcons[advisory.domain] || Brain;
          const domainColor = domainColors[advisory.domain] || "text-purple-400";
          const recColor = recommendationColors[advisory.recommendation] || { bg: "bg-slate-500/20", text: "text-slate-400" };

          return (
            <div
              key={advisory.advisoryId}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-3"
            >
              {/* Domain and Recommendation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DomainIcon className={`h-5 w-5 ${domainColor}`} />
                  <span className="text-sm font-medium text-white">
                    {advisory.domain.replace(/_/g, " ")}
                  </span>
                </div>
                <div className={`px-3 py-1 rounded-full ${recColor.bg}`}>
                  <span className={`text-xs font-semibold ${recColor.text}`}>
                    {advisory.recommendation}
                  </span>
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Confidence:</span>
                <div className="flex-1 bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${(advisory.confidence || 0) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-mono">
                  {((advisory.confidence || 0) * 100).toFixed(1)}%
                </span>
              </div>

              {/* Reasoning */}
              <div>
                <span className="text-xs text-slate-400">Reasoning:</span>
                <p className="text-sm text-slate-300 mt-1">{advisory.reasoning}</p>
              </div>

              {/* Model Version */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Model:</span>
                <code className="font-mono">{advisory.modelVersion}</code>
                {advisory.modelType && (
                  <>
                    <span>•</span>
                    <span>{advisory.modelType}</span>
                  </>
                )}
              </div>

              {/* Timestamp */}
              <div className="text-xs text-slate-500">
                {new Date(advisory.occurredAt).toLocaleString()}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
