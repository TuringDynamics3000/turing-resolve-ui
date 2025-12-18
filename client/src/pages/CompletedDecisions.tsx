import { useState } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Calendar,
  FileText,
  ExternalLink,
  ChevronDown
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CompletedDecision {
  decisionId: string;
  type: string;
  subject: string;
  amount?: number;
  currency?: string;
  customer: string;
  outcome: "APPROVED" | "REJECTED";
  decidedBy: string;
  decidedAt: string;
  policyId: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  justification: string;
  evidencePackId: string;
  executionId?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_COMPLETED: CompletedDecision[] = [
  {
    decisionId: "D-2025-000370",
    type: "Payment Approval",
    subject: "Domestic transfer",
    amount: 15000,
    currency: "$",
    customer: "ABC Manufacturing",
    outcome: "APPROVED",
    decidedBy: "Sarah Chen",
    decidedAt: new Date(Date.now() - 86400000).toISOString(),
    policyId: "PAY-001",
    riskLevel: "LOW",
    justification: "Regular supplier payment, within limits",
    evidencePackId: "EVD-2025-000370",
    executionId: "PAY-2025-004510",
  },
  {
    decisionId: "D-2025-000368",
    type: "Limit Override",
    subject: "Temporary limit increase",
    amount: 200000,
    currency: "$",
    customer: "Tech Startup Inc",
    outcome: "REJECTED",
    decidedBy: "Michael Roberts",
    decidedAt: new Date(Date.now() - 172800000).toISOString(),
    policyId: "LIM-001",
    riskLevel: "HIGH",
    justification: "Customer tenure insufficient, recommend 6-month review",
    evidencePackId: "EVD-2025-000368",
  },
  {
    decisionId: "D-2025-000365",
    type: "AML Exception",
    subject: "Transaction pattern review",
    customer: "International Traders Ltd",
    outcome: "APPROVED",
    decidedBy: "James Wilson",
    decidedAt: new Date(Date.now() - 259200000).toISOString(),
    policyId: "AML-002",
    riskLevel: "MEDIUM",
    justification: "Legitimate business activity confirmed via enhanced due diligence",
    evidencePackId: "EVD-2025-000365",
  },
  {
    decisionId: "D-2025-000362",
    type: "Manual Journal",
    subject: "Fee reversal - customer complaint",
    amount: 450,
    currency: "$",
    customer: "Smith & Partners",
    outcome: "APPROVED",
    decidedBy: "Emily Watson",
    decidedAt: new Date(Date.now() - 345600000).toISOString(),
    policyId: "JNL-001",
    riskLevel: "LOW",
    justification: "Valid complaint, fee charged in error",
    evidencePackId: "EVD-2025-000362",
    executionId: "JNL-2025-000891",
  },
  {
    decisionId: "D-2025-000358",
    type: "FX Approval",
    subject: "Large FX conversion",
    amount: 500000,
    currency: "€",
    customer: "EuroTech Solutions",
    outcome: "APPROVED",
    decidedBy: "Treasury Team",
    decidedAt: new Date(Date.now() - 432000000).toISOString(),
    policyId: "FX-002",
    riskLevel: "MEDIUM",
    justification: "Rate within acceptable variance, customer confirmed",
    evidencePackId: "EVD-2025-000358",
    executionId: "FX-2025-001234",
  },
];

// ============================================
// COMPONENTS
// ============================================

function OutcomeBadge({ outcome }: { outcome: "APPROVED" | "REJECTED" }) {
  return outcome === "APPROVED" ? (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 border">
      <CheckCircle className="w-3 h-3 mr-1" />
      Approved
    </Badge>
  ) : (
    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 border">
      <XCircle className="w-3 h-3 mr-1" />
      Rejected
    </Badge>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: "text-slate-400 border-slate-600",
    MEDIUM: "text-amber-400 border-amber-600",
    HIGH: "text-orange-400 border-orange-600",
    CRITICAL: "text-red-400 border-red-600",
  };
  
  return (
    <Badge variant="outline" className={`text-xs ${colors[level]}`}>
      {level}
    </Badge>
  );
}

function DecisionRow({ decision }: { decision: CompletedDecision }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
      {/* Main Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Outcome Icon */}
          <div className={`p-2 rounded-lg ${
            decision.outcome === "APPROVED" ? "bg-emerald-500/10" : "bg-red-500/10"
          }`}>
            {decision.outcome === "APPROVED" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-200">{decision.subject}</span>
              {decision.amount && (
                <span className="text-sm font-bold text-cyan-400">
                  {decision.currency}{decision.amount.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-mono">{decision.decisionId}</span>
              <span>•</span>
              <span>{decision.type}</span>
              <span>•</span>
              <span>{decision.customer}</span>
            </div>
          </div>
          
          {/* Meta */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-300">{decision.decidedBy}</p>
              <p className="text-xs text-slate-500">
                {new Date(decision.decidedAt).toLocaleDateString()}
              </p>
            </div>
            <RiskBadge level={decision.riskLevel} />
            <OutcomeBadge outcome={decision.outcome} />
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${
              expanded ? "rotate-180" : ""
            }`} />
          </div>
        </div>
      </button>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Policy Reference</p>
              <p className="text-sm text-cyan-400 font-mono">{decision.policyId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Decision Time</p>
              <p className="text-sm text-slate-300">
                {new Date(decision.decidedAt).toLocaleString()}
              </p>
            </div>
            {decision.executionId && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Execution ID</p>
                <p className="text-sm text-cyan-400 font-mono">{decision.executionId}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Evidence Pack</p>
              <p className="text-sm text-cyan-400 font-mono">{decision.evidencePackId}</p>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-1">Justification</p>
            <p className="text-sm text-slate-300 p-3 bg-slate-800/50 rounded">
              {decision.justification}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
              <FileText className="w-4 h-4 mr-2" />
              View Evidence Pack
            </Button>
            {decision.executionId && (
              <Button variant="ghost" size="sm" className="text-cyan-400">
                View Execution
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function CompletedDecisions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [decisions] = useState(MOCK_COMPLETED);
  
  const approvedCount = decisions.filter(d => d.outcome === "APPROVED").length;
  const rejectedCount = decisions.filter(d => d.outcome === "REJECTED").length;
  
  const filteredDecisions = decisions.filter(d =>
    d.decisionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.policyId.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Completed Decisions</h1>
            <p className="text-slate-400 mt-1">Historical decision ledger for audit and review</p>
          </div>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
        
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <p className="text-2xl font-bold text-slate-100">{decisions.length}</p>
            <p className="text-sm text-slate-400">Total Decisions</p>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
            <p className="text-sm text-slate-400">Approved</p>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
            <p className="text-sm text-slate-400">Rejected</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, subject, customer, or policy..."
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
          
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-400">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-400">
            <Calendar className="w-4 h-4 mr-2" />
            Date Range
          </Button>
        </div>
        
        {/* Decision List */}
        <div className="space-y-2">
          {filteredDecisions.map((decision) => (
            <DecisionRow key={decision.decisionId} decision={decision} />
          ))}
          
          {filteredDecisions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No decisions found</p>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </OpsConsoleLayout>
  );
}
