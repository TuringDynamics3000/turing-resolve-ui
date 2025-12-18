import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Lock, 
  Shield, 
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  Clock,
  Hash
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type DecisionOutcome = "ALLOW" | "REVIEW" | "DECLINE";

export interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  outcome: DecisionOutcome;
  reason: string;
}

export interface AuthorityRequirement {
  required: boolean;
  authorityLevel: string;
  hasAuthority: boolean;
  escalateTo?: string;
  policyRef?: string;
}

export interface DecisionIntent {
  action: string;
  subject: string;
  context: Record<string, string | number>;
  naturalLanguage: string;
}

export interface DecisionSurfaceProps {
  /** Unique decision ID */
  decisionId: string;
  /** Human-readable intent description */
  intent: DecisionIntent;
  /** Risk level (low, medium, high, critical) */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Policy evaluations that led to this decision */
  policyEvaluations: PolicyEvaluation[];
  /** Final aggregated outcome */
  outcome: DecisionOutcome;
  /** Authority requirements for action */
  authority: AuthorityRequirement;
  /** Evidence pack ID (if available) */
  evidencePackId?: string;
  /** Timestamp */
  timestamp: string;
  /** Current user's authority level */
  userAuthority?: string;
  /** Callbacks */
  onApprove?: (reason: string) => void;
  onEscalate?: () => void;
  onReject?: (reason: string) => void;
  onViewEvidence?: () => void;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function OutcomeIcon({ outcome }: { outcome: DecisionOutcome }) {
  switch (outcome) {
    case "ALLOW":
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    case "REVIEW":
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    case "DECLINE":
      return <XCircle className="w-5 h-5 text-red-400" />;
  }
}

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  const styles = {
    ALLOW: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    REVIEW: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    DECLINE: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  
  return (
    <Badge className={`${styles[outcome]} border`}>
      {outcome}
    </Badge>
  );
}

function RiskBadge({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const styles = {
    low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  
  return (
    <Badge className={`${styles[level]} border text-xs`}>
      {level.toUpperCase()} RISK
    </Badge>
  );
}

function PolicyLine({ evaluation }: { evaluation: PolicyEvaluation }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
      <OutcomeIcon outcome={evaluation.outcome} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{evaluation.policyName}</span>
          <span className="text-xs text-slate-500 font-mono">{evaluation.policyId}</span>
        </div>
        <p className="text-xs text-slate-400 truncate">{evaluation.reason}</p>
      </div>
      <OutcomeBadge outcome={evaluation.outcome} />
    </div>
  );
}

function AuthorityBlock({ authority, userAuthority }: { authority: AuthorityRequirement; userAuthority?: string }) {
  if (!authority.required) {
    return (
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">No additional authority required</span>
      </div>
    );
  }
  
  if (authority.hasAuthority) {
    return (
      <div className="flex items-center gap-2 text-emerald-400">
        <Shield className="w-4 h-4" />
        <span className="text-sm">You have authority under {authority.policyRef}</span>
      </div>
    );
  }
  
  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <div className="flex items-center gap-2 text-amber-400 mb-1">
        <Lock className="w-4 h-4" />
        <span className="text-sm font-medium">Approval required</span>
      </div>
      <p className="text-xs text-slate-400">
        You do not have authority under <span className="font-mono text-amber-300">{authority.policyRef}</span>
      </p>
      {authority.escalateTo && (
        <p className="text-xs text-slate-500 mt-1">
          Escalate to: <span className="text-slate-300">{authority.escalateTo}</span>
        </p>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DecisionSurface({
  decisionId,
  intent,
  riskLevel,
  policyEvaluations,
  outcome,
  authority,
  evidencePackId,
  timestamp,
  userAuthority,
  onApprove,
  onEscalate,
  onReject,
  onViewEvidence,
}: DecisionSurfaceProps) {
  const [expanded, setExpanded] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");
  
  const canApprove = authority.hasAuthority || !authority.required;
  const canEscalate = authority.required && !authority.hasAuthority;
  
  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm overflow-hidden">
      {/* Header - Intent Summary */}
      <CardHeader className="pb-3 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Natural Language Intent */}
            <p className="text-lg font-medium text-slate-100 mb-2">
              {intent.naturalLanguage}
            </p>
            
            {/* Context Pills */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(intent.context).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs">
                  <span className="text-slate-500">{key}:</span>
                  <span className="text-slate-300 font-medium">
                    {typeof value === "number" && key.toLowerCase().includes("amount") 
                      ? `$${value.toLocaleString()}` 
                      : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Outcome & Risk */}
          <div className="flex flex-col items-end gap-2">
            <OutcomeBadge outcome={outcome} />
            <RiskBadge level={riskLevel} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Decision Required Banner */}
        {outcome === "REVIEW" && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Decision Required</span>
            </div>
            <p className="text-sm text-slate-400">
              This action requires manual review before execution.
            </p>
          </div>
        )}
        
        {/* Policy Evaluations (Collapsible) */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Policy Impact ({policyEvaluations.length} policies evaluated)</span>
          </button>
          
          {expanded && (
            <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
              {policyEvaluations.map((evaluation, i) => (
                <PolicyLine key={i} evaluation={evaluation} />
              ))}
            </div>
          )}
        </div>
        
        {/* Authority Status */}
        <div className="pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Authority</p>
          <AuthorityBlock authority={authority} userAuthority={userAuthority} />
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          {canApprove && outcome !== "DECLINE" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => onApprove?.(approvalReason)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Approve this action under your authority</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {canEscalate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={onEscalate}
                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Escalate
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Escalate to {authority.escalateTo || "supervisor"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {outcome !== "ALLOW" && (
            <Button 
              variant="outline" 
              onClick={() => onReject?.("")}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          )}
          
          <div className="flex-1" />
          
          {/* Evidence Link */}
          {evidencePackId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onViewEvidence}
                    className="text-slate-400 hover:text-cyan-400"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Evidence
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View cryptographic evidence pack</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Footer - Metadata */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span className="font-mono">{decisionId.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date(timestamp).toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPACT VARIANT
// ============================================

export function DecisionSurfaceCompact({
  decisionId,
  intent,
  outcome,
  timestamp,
  onClick,
}: {
  decisionId: string;
  intent: DecisionIntent;
  outcome: DecisionOutcome;
  timestamp: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-900/80 transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        <OutcomeIcon outcome={outcome} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
            {intent.naturalLanguage}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(timestamp).toLocaleString()}
          </p>
        </div>
        <OutcomeBadge outcome={outcome} />
      </div>
    </button>
  );
}

export default DecisionSurface;
