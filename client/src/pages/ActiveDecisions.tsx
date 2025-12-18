import { useState } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
  ArrowRight,
  FileText
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type ExecutionStatus = 
  | "APPROVED_AWAITING_SETTLEMENT"
  | "APPROVED_AWAITING_CONFIRMATION"
  | "ESCALATED_REGULATOR_REVIEW"
  | "PROCESSING"
  | "SETTLEMENT_PENDING";

interface ActiveDecision {
  decisionId: string;
  type: string;
  subject: string;
  amount?: number;
  currency?: string;
  customer: string;
  approvedBy: string;
  approvedAt: string;
  executionStatus: ExecutionStatus;
  expectedCompletion?: string;
  progress: number;
  linkedPaymentId?: string;
  notes?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_ACTIVE: ActiveDecision[] = [
  {
    decisionId: "D-2025-000378",
    type: "Payment Approval",
    subject: "International wire transfer",
    amount: 85000,
    currency: "$",
    customer: "Global Exports Ltd",
    approvedBy: "Sarah Chen",
    approvedAt: new Date(Date.now() - 7200000).toISOString(),
    executionStatus: "APPROVED_AWAITING_SETTLEMENT",
    expectedCompletion: "2025-01-15 16:00",
    progress: 75,
    linkedPaymentId: "PAY-2025-004521",
  },
  {
    decisionId: "D-2025-000375",
    type: "AML Exception",
    subject: "Enhanced due diligence clearance",
    customer: "Oceanic Trading Pty Ltd",
    approvedBy: "James Wilson (Compliance)",
    approvedAt: new Date(Date.now() - 86400000).toISOString(),
    executionStatus: "ESCALATED_REGULATOR_REVIEW",
    progress: 40,
    notes: "Awaiting AUSTRAC confirmation - submitted 24h ago",
  },
  {
    decisionId: "D-2025-000380",
    type: "Limit Override",
    subject: "Temporary limit increase",
    amount: 150000,
    currency: "$",
    customer: "Tech Innovations Inc",
    approvedBy: "Michael Roberts",
    approvedAt: new Date(Date.now() - 3600000).toISOString(),
    executionStatus: "PROCESSING",
    expectedCompletion: "2025-01-15 14:30",
    progress: 90,
  },
];

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: ExecutionStatus }) {
  const config: Record<ExecutionStatus, { color: string; label: string }> = {
    APPROVED_AWAITING_SETTLEMENT: { 
      color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", 
      label: "Awaiting Settlement" 
    },
    APPROVED_AWAITING_CONFIRMATION: { 
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30", 
      label: "Awaiting Confirmation" 
    },
    ESCALATED_REGULATOR_REVIEW: { 
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30", 
      label: "Regulator Review" 
    },
    PROCESSING: { 
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30", 
      label: "Processing" 
    },
    SETTLEMENT_PENDING: { 
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", 
      label: "Settlement Pending" 
    },
  };
  
  const { color, label } = config[status];
  
  return (
    <Badge className={`${color} border`}>
      {status === "PROCESSING" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {label}
    </Badge>
  );
}

function ActiveDecisionCard({ decision }: { decision: ActiveDecision }) {
  return (
    <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-200">{decision.subject}</span>
            {decision.amount && (
              <span className="text-sm font-bold text-cyan-400">
                {decision.currency}{decision.amount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{decision.decisionId}</span>
            <span>•</span>
            <span>{decision.type}</span>
            <span>•</span>
            <span>{decision.customer}</span>
          </div>
        </div>
        <StatusBadge status={decision.executionStatus} />
      </div>
      
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Execution Progress</span>
          <span>{decision.progress}%</span>
        </div>
        <Progress value={decision.progress} className="h-2 bg-slate-800" />
      </div>
      
      {/* Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500 text-xs mb-1">Approved By</p>
          <p className="text-slate-300">{decision.approvedBy}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Approved At</p>
          <p className="text-slate-300">{new Date(decision.approvedAt).toLocaleString()}</p>
        </div>
        {decision.expectedCompletion && (
          <div>
            <p className="text-slate-500 text-xs mb-1">Expected Completion</p>
            <p className="text-slate-300">{decision.expectedCompletion}</p>
          </div>
        )}
        {decision.linkedPaymentId && (
          <div>
            <p className="text-slate-500 text-xs mb-1">Linked Payment</p>
            <p className="text-cyan-400 font-mono">{decision.linkedPaymentId}</p>
          </div>
        )}
      </div>
      
      {/* Notes */}
      {decision.notes && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded text-sm text-slate-400">
          {decision.notes}
        </div>
      )}
      
      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
          <FileText className="w-4 h-4 mr-2" />
          View Evidence
        </Button>
        {decision.linkedPaymentId && (
          <Button variant="ghost" size="sm" className="text-cyan-400">
            View Payment
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ActiveDecisions() {
  const [decisions] = useState(MOCK_ACTIVE);
  
  const awaitingSettlement = decisions.filter(d => 
    d.executionStatus === "APPROVED_AWAITING_SETTLEMENT" || 
    d.executionStatus === "SETTLEMENT_PENDING"
  ).length;
  
  const regulatorReview = decisions.filter(d => 
    d.executionStatus === "ESCALATED_REGULATOR_REVIEW"
  ).length;
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Active Decisions</h1>
            <p className="text-slate-400 mt-1">Approved decisions awaiting execution or confirmation</p>
          </div>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{decisions.length}</p>
                <p className="text-sm text-slate-400">Total Active</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ArrowRight className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{awaitingSettlement}</p>
                <p className="text-sm text-slate-400">Awaiting Settlement</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ExternalLink className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{regulatorReview}</p>
                <p className="text-sm text-slate-400">Regulator Review</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decision List */}
        <div className="space-y-4">
          {decisions.map((decision) => (
            <ActiveDecisionCard key={decision.decisionId} decision={decision} />
          ))}
          
          {decisions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No active decisions</p>
              <p className="text-sm">All approved decisions have been fully executed.</p>
            </div>
          )}
        </div>
      </div>
    </OpsConsoleLayout>
  );
}
