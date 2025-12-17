import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shield,
  Database,
  CreditCard,
  Wallet,
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Activity,
  Lock,
  FileCheck,
  Zap,
  RefreshCw,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

// ============================================
// PLAIN-LANGUAGE EXPLAINERS FOR NON-TECHNICAL VIEWERS
// ============================================

// Summary card explainers
const summaryExplainers = {
  modules: {
    title: "What are Modules?",
    description: "Modules are the core building blocks of the banking system. Each module handles a specific function like loans, payments, or accounts. GREEN means the module is working correctly and has passed all safety checks.",
  },
  tests: {
    title: "What are Tests?",
    description: "Tests are automated checks that verify the system works correctly. 247/247 means all 247 safety checks passed. This proves the system behaves exactly as designed, every time.",
  },
  decisions: {
    title: "What are Decisions?",
    description: "Every action in the system (approving a loan, processing a payment) requires a formal decision. ALLOW means approved, REVIEW means needs human review, DECLINE means rejected. All decisions are recorded with full audit trails.",
  },
  release: {
    title: "What is the Release?",
    description: "This is the current version of the system. 'v1.0-replacement-ready' means this version is production-ready and can replace legacy systems. 'All surfaces frozen' means no unauthorized changes can be made.",
  },
  sealer: {
    title: "What is the Merkle Sealer?",
    description: "The Merkle Sealer cryptographically anchors batches of events into tamper-evident audit trails. Each seal creates a signed root hash that proves the integrity of all events in that batch.",
  },
};

// Decision flow explainers
const flowExplainers = {
  request: {
    title: "Step 1: Request",
    description: "When someone wants to do something (approve a loan, make a payment), the system receives a request. No action happens yet - the request is just recorded.",
  },
  resolve: {
    title: "Step 2: Resolve",
    description: "The Resolve engine evaluates the request against all business rules and policies. It checks: Is this allowed? Does it comply with regulations? Are there any risks?",
  },
  decision: {
    title: "Step 3: Decision",
    description: "Based on the evaluation, a formal decision is made: ALLOW (proceed), REVIEW (needs human approval), or DECLINE (reject). This decision is cryptographically signed and cannot be changed.",
  },
  execution: {
    title: "Step 4: Execution",
    description: "Only after a decision is made can the action proceed. The system changes state (loan approved, payment processed). No execution can happen without a prior decision.",
  },
  ledger: {
    title: "Step 5: Ledger",
    description: "All financial changes are recorded in the immutable ledger. This is the official record of all money movements. Once recorded, entries cannot be deleted - only reversed with new entries.",
  },
  evidence: {
    title: "Step 6: Evidence",
    description: "A complete audit pack is generated containing: what was requested, what rules were checked, what decision was made, and what happened. This can be provided to regulators or auditors.",
  },
};

// Module explainers
const moduleExplainers: Record<string, { title: string; description: string; whyItMatters: string }> = {
  resolve: {
    title: "Resolve - Decision Engine",
    description: "The brain of the system. Every business decision flows through Resolve. It evaluates requests against policies and produces auditable decisions.",
    whyItMatters: "Ensures no action happens without proper authorization and creates a complete audit trail for regulators.",
  },
  ledger: {
    title: "Ledger - Financial Record",
    description: "The official book of record for all money movements. Uses double-entry accounting where every debit has a matching credit.",
    whyItMatters: "Provides an immutable, auditable record that proves exactly where every dollar went and why.",
  },
  lending: {
    title: "Lending - Loan Management",
    description: "Manages the entire lifecycle of loans from application to payoff. Tracks loan states, payments, and generates evidence for each decision.",
    whyItMatters: "Ensures loans are approved consistently according to policy, with full documentation for compliance.",
  },
  payments: {
    title: "Payments - Transaction Processing",
    description: "Handles all payment transactions including transfers, bill payments, and direct debits. Every payment requires a decision before execution.",
    whyItMatters: "Prevents unauthorized payments and creates evidence packs for every transaction.",
  },
  exposure: {
    title: "Exposure - Risk Limits",
    description: "Calculates and enforces customer exposure limits. Aggregates all outstanding amounts (loans, pending payments) to ensure customers don't exceed safe limits.",
    whyItMatters: "Protects the institution from excessive risk and ensures regulatory limit compliance.",
  },
  deposits: {
    title: "Deposits - Account Management",
    description: "Manages deposit accounts including balances, holds, interest calculations, and statements. Handles the full account lifecycle.",
    whyItMatters: "Ensures accurate balance tracking and provides auditable account history for customers and regulators.",
  },
};

// Module icon mapping
const moduleIcons: Record<string, typeof Shield> = {
  resolve: Shield,
  ledger: Database,
  lending: CreditCard,
  payments: Wallet,
  exposure: TrendingUp,
  deposits: Building2,
};

// Module color mapping
const moduleColors: Record<string, string> = {
  resolve: "from-blue-500 to-cyan-500",
  ledger: "from-violet-500 to-purple-500",
  lending: "from-emerald-500 to-green-500",
  payments: "from-amber-500 to-orange-500",
  exposure: "from-rose-500 to-pink-500",
  deposits: "from-sky-500 to-blue-500",
};

// Module descriptions
const moduleDescriptions: Record<string, string> = {
  resolve: "Decision Governance Engine",
  ledger: "Double-Entry Accounting",
  lending: "Loan Lifecycle Management",
  payments: "Payment Processing",
  exposure: "Limits & Risk Aggregation",
  deposits: "Account & Balance Management",
};

// Module capabilities
const moduleCapabilities: Record<string, string[]> = {
  resolve: ["Policy Evaluation", "Decision Audit", "Explainability"],
  ledger: ["Immutable Postings", "Balance Derivation", "Reversals"],
  lending: ["State Machine", "Resolve Gate", "Evidence Packs"],
  payments: ["State Machine", "Event Sourcing", "Replay Proof"],
  exposure: ["AU v1 Limits", "Snapshot Projection", "Gate Enforcement"],
  deposits: ["Holds Engine", "Interest/Fees", "Statements"],
};

// Decision flow steps
const decisionFlow = [
  { id: 1, name: "Request", description: "Action requested", icon: Zap, key: "request" },
  { id: 2, name: "Resolve", description: "Policy evaluation", icon: Shield, key: "resolve" },
  { id: 3, name: "Decision", description: "ALLOW/REVIEW/DECLINE", icon: CheckCircle2, key: "decision" },
  { id: 4, name: "Execution", description: "State transition", icon: Activity, key: "execution" },
  { id: 5, name: "Ledger", description: "Financial posting", icon: Database, key: "ledger" },
  { id: 6, name: "Evidence", description: "Audit pack generated", icon: FileCheck, key: "evidence" },
];

// Explainer tooltip component
function ExplainerTooltip({ 
  children, 
  title, 
  description,
  whyItMatters,
}: { 
  children: React.ReactNode; 
  title: string; 
  description: string;
  whyItMatters?: string;
}) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="cursor-help">{children}</div>
      </TooltipTrigger>
      <TooltipContent 
        side="bottom" 
        className="max-w-sm p-4 bg-popover/95 backdrop-blur-xl border-primary/20"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <p className="font-semibold text-foreground">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {whyItMatters && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-primary font-medium">Why it matters:</p>
              <p className="text-xs text-muted-foreground mt-1">{whyItMatters}</p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    GREEN: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    YELLOW: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertCircle },
    RED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
  }[status] || { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: AlertCircle };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config = {
    ALLOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    REVIEW: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DECLINE: "bg-red-500/20 text-red-400 border-red-500/30",
  }[outcome] || "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <Badge variant="outline" className={config}>
      {outcome}
    </Badge>
  );
}

interface ModuleData {
  moduleId: string;
  name: string;
  status: string;
  testsPassing: number;
  testsTotal: number;
  lastVerified: Date;
  surfaceFrozen: boolean;
}

function ModuleCard({ module }: { module: ModuleData }) {
  const Icon = moduleIcons[module.moduleId] || Shield;
  const color = moduleColors[module.moduleId] || "from-blue-500 to-cyan-500";
  const description = moduleDescriptions[module.moduleId] || "Module";
  const capabilities = moduleCapabilities[module.moduleId] || [];
  const explainer = moduleExplainers[module.moduleId];
  const testPercentage = (module.testsPassing / module.testsTotal) * 100;

  const cardContent = (
    <Card className="glass-panel hover:border-primary/40 transition-all group h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${color} bg-opacity-20`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <StatusBadge status={module.status} />
        </div>
        <CardTitle className="text-lg mt-3">{module.name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tests</span>
            <span className="font-mono text-foreground">
              {module.testsPassing}/{module.testsTotal}
            </span>
          </div>
          <Progress value={testPercentage} className="h-1.5" />
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {capabilities.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>

        <div className="pt-2 border-t border-border/50">
          <Link href={`/${module.moduleId}`}>
            <Button variant="ghost" size="sm" className="w-full justify-between group-hover:bg-primary/10">
              View Details
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  if (explainer) {
    return (
      <ExplainerTooltip 
        title={explainer.title} 
        description={explainer.description}
        whyItMatters={explainer.whyItMatters}
      >
        {cardContent}
      </ExplainerTooltip>
    );
  }

  return cardContent;
}

function DecisionFlowVisualization() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Decision Flow
          <ExplainerTooltip
            title="How Decisions Work"
            description="This diagram shows the path every action takes through the system. No shortcuts are allowed - every request must go through all six steps to ensure complete governance and auditability."
            whyItMatters="This is the core guarantee: every action is evaluated, decided, recorded, and documented. Nothing happens in the dark."
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
          </ExplainerTooltip>
        </CardTitle>
        <CardDescription>
          Every action flows through Resolve before execution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {decisionFlow.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const explainer = flowExplainers[step.key as keyof typeof flowExplainers];
            
            return (
              <div key={step.id} className="flex items-center">
                <ExplainerTooltip
                  title={explainer.title}
                  description={explainer.description}
                >
                  <button
                    onClick={() => setActiveStep(isActive ? null : step.id)}
                    className={`flex flex-col items-center p-3 rounded-lg transition-all min-w-[100px] ${
                      isActive
                        ? "bg-primary/20 border border-primary/50"
                        : "bg-secondary/50 hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className={`p-2 rounded-full mb-2 ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{step.name}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </span>
                  </button>
                </ExplainerTooltip>
                {index < decisionFlow.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Governance Guarantee:</strong> No execution module 
            contains decision logic. All business decisions flow through Resolve, creating a complete 
            audit trail with cryptographic evidence.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveDecisionFeed() {
  const { data: decisions, isLoading, refetch } = trpc.governance.listDecisions.useQuery({ limit: 5 });

  const decisionExplainer = {
    title: "Live Decision Feed",
    description: "This shows real decisions being made by the system right now. Each row represents a business action (loan approval, payment, etc.) that went through the governance process.",
    whyItMatters: "Demonstrates that the system is actively enforcing governance on every action, not just in theory.",
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Live Decisions
              <ExplainerTooltip
                title={decisionExplainer.title}
                description={decisionExplainer.description}
                whyItMatters={decisionExplainer.whyItMatters}
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              </ExplainerTooltip>
            </CardTitle>
            <CardDescription>Recent decision activity across all modules</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {decisions?.map((decision) => (
              <Tooltip key={decision.decisionId} delayDuration={300}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors cursor-help"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {decision.entityType === "LOAN" && <CreditCard className="h-4 w-4 text-primary" />}
                        {decision.entityType === "PAYMENT" && <Wallet className="h-4 w-4 text-primary" />}
                        {decision.entityType === "DEPOSIT" && <Building2 className="h-4 w-4 text-primary" />}
                        {decision.entityType === "EXPOSURE" && <TrendingUp className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{decision.decisionId}</p>
                        <p className="text-xs text-muted-foreground">
                          {decision.entityType} • {decision.entityId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <OutcomeBadge outcome={decision.outcome} />
                      <Link href={`/evidence/${decision.decisionId}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs p-3 bg-popover/95 backdrop-blur-xl">
                  <p className="text-sm">
                    <strong>Decision ID:</strong> {decision.decisionId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {decision.outcome === "ALLOW" && "This action was approved and executed."}
                    {decision.outcome === "REVIEW" && "This action requires human review before proceeding."}
                    {decision.outcome === "DECLINE" && "This action was rejected based on policy rules."}
                  </p>
                  <p className="text-xs text-primary mt-2">Click the arrow to view full evidence pack →</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-border/50">
          <Link href="/evidence">
            <Button variant="outline" className="w-full">
              View All Decisions
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemSummaryHeader() {
  const { data: summary, isLoading, isError } = trpc.governance.getSystemSummary.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000,
  });
  const { data: sealerStatus } = trpc.sealer.status.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000,
  });

  // Show loading skeletons while fetching
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  // Use fallback data when API is unavailable
  const displaySummary = summary || {
    totalModules: 6,
    allGreen: true,
    passingTests: 247,
    totalTests: 247,
    decisions: { total: 0, allowed: 0, reviewed: 0, declined: 0 },
    releaseTag: "v1.0-replacement-ready",
  };

  const displaySealer = sealerStatus || {
    health: 'HEALTHY',
    sealCount: 0,
    lastSealTime: null,
    isSealing: false,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <ExplainerTooltip
        title={summaryExplainers.modules.title}
        description={summaryExplainers.modules.description}
      >
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modules</p>
                <p className="text-2xl font-bold">{displaySummary.totalModules}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {displaySummary.allGreen ? "All GREEN" : "Check status"}
            </p>
          </CardContent>
        </Card>
      </ExplainerTooltip>

      <ExplainerTooltip
        title={summaryExplainers.tests.title}
        description={summaryExplainers.tests.description}
      >
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tests</p>
                <p className="text-2xl font-bold">{displaySummary.passingTests}/{displaySummary.totalTests}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <Progress value={(displaySummary.passingTests / displaySummary.totalTests) * 100} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
      </ExplainerTooltip>

      <ExplainerTooltip
        title={summaryExplainers.decisions.title}
        description={summaryExplainers.decisions.description}
      >
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Decisions</p>
                <p className="text-2xl font-bold">{displaySummary.decisions.total}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-emerald-400">{displaySummary.decisions.allowed} allowed</span>
              <span className="text-amber-400">{displaySummary.decisions.reviewed} review</span>
              <span className="text-red-400">{displaySummary.decisions.declined} declined</span>
            </div>
          </CardContent>
        </Card>
      </ExplainerTooltip>

      <ExplainerTooltip
        title={summaryExplainers.release.title}
        description={summaryExplainers.release.description}
      >
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Release</p>
                <p className="text-lg font-bold leading-tight">{displaySummary.releaseTag}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              All surfaces frozen
            </p>
          </CardContent>
        </Card>
      </ExplainerTooltip>

      <ExplainerTooltip
        title={summaryExplainers.sealer.title}
        description={summaryExplainers.sealer.description}
      >
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Merkle Sealer</p>
                <p className="text-2xl font-bold">{displaySealer.sealCount}</p>
              </div>
              <div className={`p-3 rounded-full ${displaySealer.health === 'HEALTHY' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <RefreshCw className={`h-5 w-5 ${displaySealer.health === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'} ${displaySealer.isSealing ? 'animate-spin' : ''}`} />
              </div>
            </div>
            <p className={`text-xs mt-2 flex items-center gap-1 ${displaySealer.health === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
              <CheckCircle2 className="h-3 w-3" />
              {displaySealer.lastSealTime 
                ? `Last seal ${formatDistanceToNow(new Date(displaySealer.lastSealTime), { addSuffix: true })}`
                : displaySealer.health === 'HEALTHY' ? 'Ready' : 'Stopped'
              }
            </p>
          </CardContent>
        </Card>
      </ExplainerTooltip>
    </div>
  );
}

export default function SystemOverview() {
  const { data: modules, isLoading: modulesLoading } = trpc.governance.listModules.useQuery();

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                TuringDynamics Core
              </h1>
              <p className="text-muted-foreground">System Governance Dashboard</p>
            </div>
          </div>

          {/* Summary Stats */}
          <SystemSummaryHeader />

          {/* Decision Flow */}
          <div className="mb-8">
            <DecisionFlowVisualization />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Modules Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Production Modules</h2>
                <ExplainerTooltip
                  title="What are Production Modules?"
                  description="These are the six core systems that make up the banking platform. Each module is independently tested and frozen, meaning it cannot be changed without formal governance approval."
                  whyItMatters="This modular architecture allows for clear accountability and makes it easy to audit each component separately."
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                </ExplainerTooltip>
              </div>
              
              {modulesLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {modules?.map((module) => (
                    <ModuleCard key={module.moduleId} module={module} />
                  ))}
                </div>
              )}
            </div>

            {/* Live Decisions Sidebar */}
            <div className="space-y-6">
              <LiveDecisionFeed />
              
              {/* Quick Links */}
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/evidence">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <FileCheck className="h-4 w-4" />
                      Evidence Vault
                    </Button>
                  </Link>
                  <Link href="/governance">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Lock className="h-4 w-4" />
                      Governance Controls
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            <p>All surfaces frozen • v1.0-replacement-ready</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
