import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Shield, 
  FileText,
  ExternalLink,
  ChevronRight,
  User,
  Zap,
  Lock
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type DecisionStatus = "PENDING" | "ESCALATED" | "APPROVED" | "REJECTED" | "EXPIRED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DecisionType = 
  | "PAYMENT_APPROVAL" 
  | "LIMIT_OVERRIDE" 
  | "AML_EXCEPTION" 
  | "MANUAL_JOURNAL" 
  | "FX_APPROVAL"
  | "ACCOUNT_ACTION"
  | "LOAN_APPROVAL";

export interface PolicyTrigger {
  policyId: string;
  policyName: string;
  description: string;
  allowedAuthorities: string[];
}

export interface DecisionSubject {
  type: string;
  description: string;
  amount?: number;
  currency?: string;
  from?: string;
  to?: string;
  channel?: string;
  customer?: string;
}

export interface UserAuthority {
  role: string;
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  reason?: string;
}

export interface DecisionCardData {
  decisionId: string;
  status: DecisionStatus;
  riskLevel: RiskLevel;
  decisionType: DecisionType;
  slaRemaining?: string;
  slaExpired?: boolean;
  
  // What is happening
  subject: DecisionSubject;
  
  // Why this needs a decision
  triggers: string[];
  policyTriggered: PolicyTrigger;
  
  // Your authority
  userAuthority: UserAuthority;
  
  // What happens next
  onApprovalOutcome: string;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
}

export interface DecisionCardProps {
  data: DecisionCardData;
  onApprove?: (justification: string) => void;
  onReject?: (justification: string) => void;
  onEscalate?: () => void;
  onViewEvidence?: () => void;
  compact?: boolean;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatusBadge({ status }: { status: DecisionStatus }) {
  const config = {
    PENDING: { icon: Clock, color: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "Pending Approval" },
    ESCALATED: { icon: User, color: "bg-purple-500/20 text-purple-300 border-purple-500/30", label: "Escalated" },
    APPROVED: { icon: CheckCircle, color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Approved" },
    REJECTED: { icon: XCircle, color: "bg-red-500/20 text-red-300 border-red-500/30", label: "Rejected" },
    EXPIRED: { icon: AlertTriangle, color: "bg-slate-500/20 text-slate-300 border-slate-500/30", label: "Expired" },
  };
  
  const { icon: Icon, color, label } = config[status];
  
  return (
    <Badge className={`${color} border flex items-center gap-1.5`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    LOW: { color: "bg-slate-500/20 text-slate-300 border-slate-500/30", emoji: "🟢" },
    MEDIUM: { color: "bg-amber-500/20 text-amber-300 border-amber-500/30", emoji: "🟡" },
    HIGH: { color: "bg-orange-500/20 text-orange-300 border-orange-500/30", emoji: "🟠" },
    CRITICAL: { color: "bg-red-500/20 text-red-300 border-red-500/30", emoji: "🔴" },
  };
  
  const { color, emoji } = config[level];
  
  return (
    <Badge className={`${color} border`}>
      {emoji} {level}
    </Badge>
  );
}

function SLATimer({ remaining, expired }: { remaining?: string; expired?: boolean }) {
  if (!remaining) return null;
  
  return (
    <div className={`flex items-center gap-1.5 text-sm ${expired ? "text-red-400" : "text-slate-400"}`}>
      <Clock className="w-4 h-4" />
      <span>{expired ? "OVERDUE" : `${remaining} remaining`}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-slate-800 last:border-0">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DecisionCard({ 
  data, 
  onApprove, 
  onReject, 
  onEscalate,
  onViewEvidence,
  compact = false 
}: DecisionCardProps) {
  const [justification, setJustification] = useState("");
  const [actionTaken, setActionTaken] = useState<"approve" | "reject" | null>(null);
  
  const handleApprove = () => {
    if (!justification.trim()) return;
    setActionTaken("approve");
    onApprove?.(justification);
  };
  
  const handleReject = () => {
    if (!justification.trim()) return;
    setActionTaken("reject");
    onReject?.(justification);
  };
  
  const isPending = data.status === "PENDING" || data.status === "ESCALATED";
  
  if (compact) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-200 truncate">
                  {data.subject.description}
                </span>
                <RiskBadge level={data.riskLevel} />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="font-mono">{data.decisionId}</span>
                <span>•</span>
                <span>{data.policyTriggered.policyId}</span>
                <span>•</span>
                <span>{data.userAuthority.role} required</span>
              </div>
            </div>
            <StatusBadge status={data.status} />
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-slate-900/90 border-slate-700/50 backdrop-blur-sm overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">DECISION CARD</h2>
          <StatusBadge status={data.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Decision ID:</span>
            <span className="ml-2 font-mono text-slate-300">{data.decisionId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Risk:</span>
            <RiskBadge level={data.riskLevel} />
          </div>
          {data.slaRemaining && (
            <div className="col-span-2">
              <SLATimer remaining={data.slaRemaining} expired={data.slaExpired} />
            </div>
          )}
        </div>
      </div>
      
      <CardContent className="p-6">
        {/* WHAT IS HAPPENING */}
        <Section title="What is happening">
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-100">
              {data.subject.description}
            </p>
            {data.subject.amount && (
              <p className="text-2xl font-bold text-cyan-400">
                {data.subject.currency || "$"}{data.subject.amount.toLocaleString()}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.subject.from && (
                <div>
                  <span className="text-slate-500">From:</span>
                  <span className="ml-2 text-slate-300">{data.subject.from}</span>
                </div>
              )}
              {data.subject.to && (
                <div>
                  <span className="text-slate-500">To:</span>
                  <span className="ml-2 text-slate-300">{data.subject.to}</span>
                </div>
              )}
              {data.subject.channel && (
                <div>
                  <span className="text-slate-500">Channel:</span>
                  <span className="ml-2 text-slate-300">{data.subject.channel}</span>
                </div>
              )}
              {data.subject.customer && (
                <div>
                  <span className="text-slate-500">Customer:</span>
                  <span className="ml-2 text-slate-300">{data.subject.customer}</span>
                </div>
              )}
            </div>
          </div>
        </Section>
        
        {/* WHY THIS NEEDS A DECISION */}
        <Section title="Why this needs a decision">
          <ul className="space-y-2">
            {data.triggers.map((trigger, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400 mt-0.5">•</span>
                {trigger}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-amber-400 mt-0.5">•</span>
              Policy triggered: <span className="font-mono text-cyan-400">{data.policyTriggered.policyId}</span>
            </li>
          </ul>
        </Section>
        
        {/* POLICY CONTEXT */}
        <Section title="Policy context">
          <div className="p-3 bg-slate-800/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">{data.policyTriggered.policyId}</span>
            </div>
            <p className="text-sm text-slate-300">{data.policyTriggered.description}</p>
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Allowed authorities:</p>
              <div className="flex flex-wrap gap-2">
                {data.policyTriggered.allowedAuthorities.map((auth, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-300">
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" />
                    {auth}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Section>
        
        {/* YOUR AUTHORITY */}
        <Section title="Your authority">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-300">Role: <strong>{data.userAuthority.role}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={data.userAuthority.canApprove ? "text-emerald-400" : "text-red-400"}>
                {data.userAuthority.canApprove ? "✔" : "✖"} Approve
              </span>
              <span className={data.userAuthority.canReject ? "text-emerald-400" : "text-red-400"}>
                {data.userAuthority.canReject ? "✔" : "✖"} Reject
              </span>
            </div>
          </div>
          {!data.userAuthority.canApprove && data.userAuthority.reason && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {data.userAuthority.reason}
            </div>
          )}
        </Section>
        
        {/* DECISION ACTION */}
        {isPending && (
          <Section title="Decision action">
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={!data.userAuthority.canApprove || !justification.trim() || actionTaken !== null}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!data.userAuthority.canReject || !justification.trim() || actionTaken !== null}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                {data.userAuthority.canEscalate && (
                  <Button
                    onClick={onEscalate}
                    disabled={actionTaken !== null}
                    variant="outline"
                    className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Escalate
                  </Button>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Justification <span className="text-red-400">(required)</span>
                </label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Enter your justification for this decision..."
                  className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 min-h-[80px]"
                  disabled={actionTaken !== null}
                />
              </div>
            </div>
          </Section>
        )}
        
        {/* WHAT HAPPENS NEXT */}
        <Section title="What happens next">
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span>On approval → {data.onApprovalOutcome}</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span>Decision recorded immutably</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span>Evidence pack generated automatically</span>
            </li>
          </ul>
        </Section>
        
        {/* Footer */}
        <div className="pt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewEvidence}
            className="text-slate-400 hover:text-cyan-400"
          >
            <FileText className="w-4 h-4 mr-2" />
            View Evidence Pack
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          
          <span className="text-xs text-slate-500">
            Created: {new Date(data.createdAt).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default DecisionCard;
