import { useState } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { DecisionCard, DecisionCardData } from "@/components/DecisionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { 
  Filter, 
  SortAsc, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

type DecisionType = 'PAYMENT' | 'LENDING' | 'LIMIT_OVERRIDE' | 'ACCOUNT_ACTION' | 'COMPLIANCE';
type DecisionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// ============================================
// COMPONENTS
// ============================================

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color,
  loading = false
}: { 
  label: string; 
  value: number; 
  icon: React.ElementType; 
  color: string;
  loading?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          {loading ? (
            <Skeleton className="h-8 w-12 bg-slate-700" />
          ) : (
            <p className="text-2xl font-bold text-slate-100">{value}</p>
          )}
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
  decision: {
    id: string;
    type: DecisionType;
    status: string;
    priority: DecisionPriority;
    title: string;
    summary: string;
    customerName: string;
    customerId: string;
    amount?: number;
    currency?: string;
    slaDeadline: Date;
    policyContext: {
      policyId: string;
      policyName: string;
      outcome: string;
      reason: string;
    };
  }; 
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
    IN_PROGRESS: Loader2,
    APPROVED: CheckCircle,
    DECLINED: XCircle,
    ESCALATED: AlertTriangle,
    EXPIRED: AlertTriangle,
  };
  
  const StatusIcon = statusIcons[decision.status as keyof typeof statusIcons] || Clock;
  
  // Calculate SLA remaining
  const now = new Date();
  const slaDeadline = new Date(decision.slaDeadline);
  const slaRemainingMs = slaDeadline.getTime() - now.getTime();
  const slaExpired = slaRemainingMs < 0;
  const slaMinutes = Math.abs(Math.floor(slaRemainingMs / 60000));
  const slaHours = Math.floor(slaMinutes / 60);
  const slaRemaining = slaExpired 
    ? `-${slaHours.toString().padStart(2, '0')}:${(slaMinutes % 60).toString().padStart(2, '0')}`
    : `${slaHours.toString().padStart(2, '0')}:${(slaMinutes % 60).toString().padStart(2, '0')}`;
  
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
              {decision.title}
            </span>
            {decision.amount && (
              <span className="text-sm font-bold text-cyan-400">
                {decision.currency || '$'}{decision.amount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-mono">{decision.id}</span>
            <span>•</span>
            <span className="text-cyan-400">{decision.policyContext.policyId}</span>
            <span>•</span>
            <span>{decision.customerName}</span>
          </div>
        </div>
        
        {/* Risk & SLA */}
        <div className="flex items-center gap-4">
          <Badge className={`${riskColors[decision.priority]} bg-transparent border-current`}>
            {decision.priority}
          </Badge>
          
          <div className={`flex items-center gap-1 text-sm ${
            slaExpired ? "text-red-400" : "text-slate-400"
          }`}>
            <Clock className="w-4 h-4" />
            {slaRemaining}
          </div>
          
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
            {decision.type.replace('_', ' ')}
          </Badge>
          
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ============================================
// TRANSFORM FUNCTION
// ============================================

function transformToDecisionCardData(decision: {
  id: string;
  type: DecisionType;
  status: string;
  priority: DecisionPriority;
  title: string;
  summary: string;
  customerName: string;
  customerId: string;
  amount?: number;
  currency?: string;
  createdAt: Date;
  slaDeadline: Date;
  policyContext: {
    policyId: string;
    policyName: string;
    version: string;
    outcome: string;
    reason: string;
  };
  facts: Record<string, unknown>;
}): DecisionCardData {
  const now = new Date();
  const slaDeadline = new Date(decision.slaDeadline);
  const slaRemainingMs = slaDeadline.getTime() - now.getTime();
  const slaExpired = slaRemainingMs < 0;
  const slaMinutes = Math.abs(Math.floor(slaRemainingMs / 60000));
  const slaHours = Math.floor(slaMinutes / 60);
  const slaRemaining = `${slaHours.toString().padStart(2, '0')}:${(slaMinutes % 60).toString().padStart(2, '0')}`;

  return {
    decisionId: decision.id,
    status: decision.status === 'PENDING' ? 'PENDING' : 
            decision.status === 'IN_PROGRESS' ? 'PENDING' :
            decision.status === 'APPROVED' ? 'APPROVED' :
            decision.status === 'DECLINED' ? 'REJECTED' :
            decision.status === 'ESCALATED' ? 'ESCALATED' : 'EXPIRED',
    riskLevel: decision.priority,
    decisionType: decision.type === 'PAYMENT' ? 'PAYMENT_APPROVAL' :
                  decision.type === 'LENDING' ? 'LOAN_APPROVAL' :
                  decision.type === 'LIMIT_OVERRIDE' ? 'LIMIT_OVERRIDE' :
                  decision.type === 'COMPLIANCE' ? 'AML_EXCEPTION' : 'MANUAL_JOURNAL',
    slaRemaining,
    slaExpired,
    subject: {
      type: decision.type.toLowerCase(),
      description: decision.title,
      amount: decision.amount,
      currency: decision.currency || '$',
      customer: decision.customerName,
    },
    triggers: [
      decision.policyContext.reason,
      `Risk Level: ${decision.priority}`,
    ],
    policyTriggered: {
      policyId: decision.policyContext.policyId,
      policyName: decision.policyContext.policyName,
      description: decision.policyContext.reason,
      allowedAuthorities: decision.policyContext.outcome === 'ESCALATE' 
        ? ['Manager', 'Compliance Officer'] 
        : ['Supervisor', 'Ops Analyst'],
    },
    userAuthority: {
      role: 'Supervisor',
      canApprove: decision.policyContext.outcome !== 'ESCALATE',
      canReject: true,
      canEscalate: true,
      reason: decision.policyContext.outcome === 'ESCALATE' 
        ? 'Escalated - requires higher authority' 
        : undefined,
    },
    onApprovalOutcome: 'Execution delegated to TuringCore',
    createdAt: new Date(decision.createdAt).toISOString(),
  };
}

// ============================================
// MAIN PAGE
// ============================================

export default function DecisionInbox() {
  const [selectedDecision, setSelectedDecision] = useState<DecisionCardData | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "escalated">("all");
  const [typeFilter, setTypeFilter] = useState<DecisionType | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<DecisionPriority | undefined>(undefined);
  
  // Fetch pending decisions from tRPC
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = trpc.ops.getPendingDecisions.useQuery({
    type: typeFilter,
    priority: priorityFilter,
    limit: 50,
    offset: 0,
  }, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch decision stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.ops.getDecisionStats.useQuery(undefined, {
    refetchInterval: 30000,
  });
  
  // Submit decision mutation
  const submitDecision = trpc.ops.submitDecision.useMutation({
    onSuccess: (result) => {
      toast.success(`Decision ${result.newStatus.toLowerCase()}`, {
        description: `Evidence pack: ${result.evidencePackId}`,
      });
      setSelectedDecision(null);
      refetchPending();
      refetchStats();
    },
    onError: (error) => {
      toast.error('Failed to submit decision', {
        description: error.message,
      });
    },
  });
  
  const handleRefresh = () => {
    refetchPending();
    refetchStats();
    toast.info('Refreshing decision queue...');
  };
  
  const decisions = pendingData?.items || [];
  
  const filteredDecisions = decisions.filter(d => {
    if (filter === "pending") return d.status === "PENDING";
    if (filter === "escalated") return d.status === "IN_PROGRESS"; // Map escalated to in_progress for now
    return true;
  });
  
  const pendingCount = stats?.pending ?? 0;
  const escalatedCount = stats?.inProgress ?? 0;
  const criticalCount = stats?.byPriority?.critical ?? 0;
  const totalToday = stats?.completedToday ?? 0;
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Decision Inbox</h1>
            <p className="text-slate-400 mt-1">Items requiring your authority</p>
          </div>
          <Button 
            variant="outline" 
            className="border-slate-700 text-slate-300"
            onClick={handleRefresh}
            disabled={pendingLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${pendingLoading ? 'animate-spin' : ''}`} />
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
            loading={statsLoading}
          />
          <StatCard 
            label="In Progress" 
            value={escalatedCount} 
            icon={Loader2}
            color="bg-purple-500/10 border-purple-500/30 text-purple-400"
            loading={statsLoading}
          />
          <StatCard 
            label="Critical Risk" 
            value={criticalCount} 
            icon={AlertTriangle}
            color="bg-red-500/10 border-red-500/30 text-red-400"
            loading={statsLoading}
          />
          <StatCard 
            label="Completed Today" 
            value={totalToday} 
            icon={CheckCircle}
            color="bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            loading={statsLoading}
          />
        </div>
        
        {/* SLA Breach Warning */}
        {stats && stats.slaBreached > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">
              <strong>{stats.slaBreached} decisions</strong> have breached SLA. Immediate attention required.
            </span>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-cyan-600" : "border-slate-700 text-slate-400"}
          >
            All ({decisions.length})
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
            In Progress ({escalatedCount})
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
                const originalDecision = decisions.find(d => d.id === selectedDecision.decisionId);
                if (originalDecision) {
                  submitDecision.mutate({
                    decisionId: originalDecision.id,
                    action: 'APPROVE',
                    reason: justification,
                  });
                }
              }}
              onReject={(justification) => {
                const originalDecision = decisions.find(d => d.id === selectedDecision.decisionId);
                if (originalDecision) {
                  submitDecision.mutate({
                    decisionId: originalDecision.id,
                    action: 'DECLINE',
                    reason: justification,
                  });
                }
              }}
              onEscalate={() => {
                const originalDecision = decisions.find(d => d.id === selectedDecision.decisionId);
                if (originalDecision) {
                  submitDecision.mutate({
                    decisionId: originalDecision.id,
                    action: 'ESCALATE',
                    reason: 'Escalated to higher authority',
                  });
                }
              }}
            />
          </div>
        ) : pendingLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDecisions.map((decision) => (
              <DecisionRow
                key={decision.id}
                decision={decision}
                onClick={() => setSelectedDecision(transformToDecisionCardData(decision))}
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
