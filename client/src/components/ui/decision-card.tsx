import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { RiskIndicator } from "./risk-indicator";
import { Clock, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Link } from "wouter";

export interface DecisionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  decisionId: string;
  entityId: string;
  outcome: "approve" | "decline" | "flag" | "review" | "pass";
  riskScore?: number;
  timestamp: string;
  summary?: string;
  href?: string;
}

function getOutcomeConfig(outcome: DecisionCardProps["outcome"]) {
  switch (outcome) {
    case "approve":
      return {
        variant: "success" as const,
        label: "Approved",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case "decline":
      return {
        variant: "destructive" as const,
        label: "Declined",
        icon: <XCircle className="w-3.5 h-3.5" />,
      };
    case "flag":
      return {
        variant: "destructive" as const,
        label: "Flagged",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    case "review":
      return {
        variant: "warning" as const,
        label: "Review",
        icon: <HelpCircle className="w-3.5 h-3.5" />,
      };
    case "pass":
      return {
        variant: "success" as const,
        label: "Pass",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
  }
}

export function DecisionCard({
  decisionId,
  entityId,
  outcome,
  riskScore,
  timestamp,
  summary,
  href,
  className,
  ...props
}: DecisionCardProps) {
  const outcomeConfig = getOutcomeConfig(outcome);

  const CardContent = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-muted-foreground truncate">
            {decisionId}
          </p>
          <p className="font-medium text-foreground mt-0.5">{entityId}</p>
        </div>
        <StatusBadge variant={outcomeConfig.variant} icon={outcomeConfig.icon}>
          {outcomeConfig.label}
        </StatusBadge>
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-border/50">
        {/* Risk Score */}
        {riskScore !== undefined && (
          <div className="flex-1 max-w-[120px]">
            <RiskIndicator value={riskScore} size="sm" />
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{timestamp}</span>
        </div>
      </div>
    </>
  );

  const cardClasses = cn(
    "decision-card group cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className
  );

  if (href) {
    return (
      <Link href={href}>
        <div className={cardClasses} tabIndex={0} role="article" {...props}>
          {CardContent}
        </div>
      </Link>
    );
  }

  return (
    <div className={cardClasses} tabIndex={0} role="article" {...props}>
      {CardContent}
    </div>
  );
}

// Skeleton loader for DecisionCard
export function DecisionCardSkeleton() {
  return (
    <div className="decision-card animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded" />
        </div>
        <div className="h-6 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-4 w-full bg-muted rounded mt-3" />
      <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-border/50">
        <div className="h-2 w-24 bg-muted rounded-full" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}
