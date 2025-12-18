import { useState } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { DecisionCard, DecisionCardData } from "@/components/DecisionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Filter, 
  SortAsc, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw
} from "lucide-react";

// ============================================
// MOCK DATA
// ============================================

const MOCK_DECISIONS: DecisionCardData[] = [
  {
    decisionId: "D-2025-000381",
    status: "PENDING",
    riskLevel: "HIGH",
    decisionType: "PAYMENT_APPROVAL",
    slaRemaining: "01:12",
    subject: {
      type: "payment",
      description: "High-value external payment",
      amount: 40000,
      currency: "£",
      from: "Wallet A (Customer X)",
      to: "External Beneficiary Y",
      channel: "Faster Payments",
      customer: "Acme Corp Ltd",
    },
    triggers: [
      "Exceeds standard limit (£25,000)",
      "No previous override in period",
      "New beneficiary (first payment)",
    ],
    policyTriggered: {
      policyId: "PAY-004",
      policyName: "High-Value External Payments",
      description: "High-value external payments require supervisor review",
      allowedAuthorities: ["Supervisor", "Dual Control (Ops + Compliance)"],
    },
    userAuthority: {
      role: "Supervisor",
      canApprove: true,
      canReject: true,
      canEscalate: true,
    },
    onApprovalOutcome: "Execution delegated to TuringCore",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    decisionId: "D-2025-000382",
    status: "PENDING",
    riskLevel: "CRITICAL",
    decisionType: "AML_EXCEPTION",
    slaRemaining: "00:45",
    slaExpired: false,
    subject: {
      type: "aml_review",
      description: "AML alert - unusual transaction pattern",
      amount: 125000,
      currency: "$",
      customer: "Global Trading Pty Ltd",
    },
    triggers: [
      "Multiple large transactions in 24h",
      "New jurisdiction (first time)",
      "AML score: 78 (threshold: 70)",
    ],
    policyTriggered: {
      policyId: "AML-002",
      policyName: "Enhanced Due Diligence",
      description: "Transactions triggering AML alerts require compliance review",
      allowedAuthorities: ["Compliance Officer", "MLRO"],
    },
    userAuthority: {
      role: "Supervisor",
      canApprove: false,
      canReject: false,
      canEscalate: true,
      reason: "AML decisions require Compliance authority",
    },
    onApprovalOutcome: "Transaction released, monitoring continues",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    decisionId: "D-2025-000383",
    status: "ESCALATED",
    riskLevel: "MEDIUM",
    decisionType: "LIMIT_OVERRIDE",
    slaRemaining: "02:30",
    subject: {
      type: "limit_override",
      description: "Temporary limit increase request",
      amount: 100000,
      currency: "$",
      customer: "Smith Industries",
    },
    triggers: [
      "Requested limit exceeds tier maximum",
      "Customer tenure: 6 months",
    ],
    policyTriggered: {
      policyId: "LIM-001",
      policyName: "Limit Override Policy",
      description: "Limit overrides above tier maximum require manager approval",
      allowedAuthorities: ["Manager", "Credit Committee"],
    },
    userAuthority: {
      role: "Supervisor",
      canApprove: false,
      canReject: true,
      canEscalate: false,
      reason: "Escalated to Manager - awaiting decision",
    },
    onApprovalOutcome: "Temporary limit applied for 30 days",
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    decisionId: "D-2025-000384",
    status: "PENDING",
    riskLevel: "LOW",
    decisionType: "MANUAL_JOURNAL",
    slaRemaining: "04:00",
    subject: {
      type: "journal",
      description: "Manual journal entry - fee reversal",
      amount: 250,
      currency: "$",
      customer: "Johnson & Partners",
    },
    triggers: [
      "Manual journal requires dual approval",
      "Customer complaint reference: CMP-2025-0891",
    ],
    policyTriggered: {
      policyId: "JNL-001",
      policyName: "Manual Journal Policy",
      description: "All manual journals require maker-checker approval",
      allowedAuthorities: ["Supervisor", "Finance Officer"],
    },
    userAuthority: {
      role: "Supervisor",
      canApprove: true,
      canReject: true,
      canEscalate: true,
    },
    onApprovalOutcome: "Journal posted to ledger",
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    decisionId: "D-2025-000385",
    status: "PENDING",
    riskLevel: "MEDIUM",
    decisionType: "FX_APPROVAL",
    slaRemaining: "00:30",
    subject: {
      type: "fx_trade",
      description: "FX conversion - large amount",
      amount: 75000,
      currency: "€",
      from: "AUD Account",
      to: "EUR Account",
      customer: "EuroTech Solutions",
    },
    triggers: [
      "Amount exceeds auto-approval threshold",
      "Rate variance: 0.3% from mid-market",
    ],
    policyTriggered: {
      policyId: "FX-002",
      policyName: "Large FX Trades",
      description: "FX trades above threshold require treasury approval",
      allowedAuthorities: ["Treasury", "Supervisor"],
    },
    userAuthority: {
      role: "Supervisor",
      canApprove: true,
      canReject: true,
      canEscalate: true,
    },
    onApprovalOutcome: "FX trade executed at quoted rate",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

// ============================================
// COMPONENTS
// ============================================

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: number; 
  icon: React.ElementType; 
  color: string;
}) {
  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
        <Icon className="w-8 h-8 opacity-50" />
      </div>
    </div>
  );
}

function DecisionRow({ 
  decision, 
  onClick 
}: { 
  decision: DecisionCardData; 
  onClick: () => void;
}) {
  const riskColors = {
    LOW: "text-slate-400",
    MEDIUM: "text-amber-400",
    HIGH: "text-orange-400",
    CRITICAL: "text-red-400",
  };
  
  const statusIcons = {
    PENDING: Clock,
    ESCALATED: AlertTriangle,
    APPROVED: CheckCircle,
    REJECTED: XCircle,
    EXPIRED: AlertTriangle,
  };
  
  const StatusIcon = statusIcons[decision.status];
  
  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-cyan-500/30 hover:bg-slate-900/80 transition-all text-left group"
    >
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className={`p-2 rounded-lg ${
          decision.status === "PENDING" ? "bg-amber-500/10" : 
          decision.status === "ESCALATED" ? "bg-purple-500/10" : "bg-slate-800"
        }`}>
          <StatusIcon className={`w-5 h-5 ${
            decision.status === "PENDING" ? "text-amber-400" : 
            decision.status === "ESCALATED" ? "text-purple-400" : "text-slate-400"
          }`} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-200 group-hover:text-white">
              {decision.subject.description}
            </span>
            {decision.subject.amount && (
              <span className="text-sm font-bold text-cyan-400">
                {decision.subject.currency}{decision.subject.amount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-mono">{decision.decisionId}</span>
            <span>•</span>
            <span className="text-cyan-400">{decision.policyTriggered.policyId}</span>
            <span>•</span>
            <span>{decision.subject.customer}</span>
          </div>
        </div>
        
        {/* Risk & SLA */}
        <div className="flex items-center gap-4">
          <Badge className={`${riskColors[decision.riskLevel]} bg-transparent border-current`}>
            {decision.riskLevel}
          </Badge>
          
          {decision.slaRemaining && (
            <div className={`flex items-center gap-1 text-sm ${
              decision.slaExpired ? "text-red-400" : "text-slate-400"
            }`}>
              <Clock className="w-4 h-4" />
              {decision.slaRemaining}
            </div>
          )}
          
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
            {decision.userAuthority.role}
          </Badge>
          
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function DecisionInbox() {
  const [selectedDecision, setSelectedDecision] = useState<DecisionCardData | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "escalated">("all");
  
  const filteredDecisions = MOCK_DECISIONS.filter(d => {
    if (filter === "pending") return d.status === "PENDING";
    if (filter === "escalated") return d.status === "ESCALATED";
    return true;
  });
  
  const pendingCount = MOCK_DECISIONS.filter(d => d.status === "PENDING").length;
  const escalatedCount = MOCK_DECISIONS.filter(d => d.status === "ESCALATED").length;
  const criticalCount = MOCK_DECISIONS.filter(d => d.riskLevel === "CRITICAL").length;
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Decision Inbox</h1>
            <p className="text-slate-400 mt-1">Items requiring your authority</p>
          </div>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Pending Decisions" 
            value={pendingCount} 
            icon={Clock}
            color="bg-amber-500/10 border-amber-500/30 text-amber-400"
          />
          <StatCard 
            label="Escalated" 
            value={escalatedCount} 
            icon={AlertTriangle}
            color="bg-purple-500/10 border-purple-500/30 text-purple-400"
          />
          <StatCard 
            label="Critical Risk" 
            value={criticalCount} 
            icon={AlertTriangle}
            color="bg-red-500/10 border-red-500/30 text-red-400"
          />
          <StatCard 
            label="Total Today" 
            value={MOCK_DECISIONS.length} 
            icon={CheckCircle}
            color="bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
          />
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-cyan-600" : "border-slate-700 text-slate-400"}
          >
            All ({MOCK_DECISIONS.length})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            className={filter === "pending" ? "bg-amber-600" : "border-slate-700 text-slate-400"}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={filter === "escalated" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("escalated")}
            className={filter === "escalated" ? "bg-purple-600" : "border-slate-700 text-slate-400"}
          >
            Escalated ({escalatedCount})
          </Button>
          
          <div className="flex-1" />
          
          <Button variant="ghost" size="sm" className="text-slate-400">
            <Filter className="w-4 h-4 mr-2" />
            More Filters
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-400">
            <SortAsc className="w-4 h-4 mr-2" />
            Sort
          </Button>
        </div>
        
        {/* Decision List or Detail */}
        {selectedDecision ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDecision(null)}
              className="text-slate-400 mb-4"
            >
              ← Back to Inbox
            </Button>
            <DecisionCard 
              data={selectedDecision}
              onApprove={(justification) => {
                console.log("Approved:", justification);
                setSelectedDecision(null);
              }}
              onReject={(justification) => {
                console.log("Rejected:", justification);
                setSelectedDecision(null);
              }}
              onEscalate={() => {
                console.log("Escalated");
                setSelectedDecision(null);
              }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDecisions.map((decision) => (
              <DecisionRow
                key={decision.decisionId}
                decision={decision}
                onClick={() => setSelectedDecision(decision)}
              />
            ))}
            
            {filteredDecisions.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No decisions require your attention right now.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </OpsConsoleLayout>
  );
}
