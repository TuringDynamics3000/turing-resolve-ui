import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";

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
  { id: 1, name: "Request", description: "Action requested", icon: Zap },
  { id: 2, name: "Resolve", description: "Policy evaluation", icon: Shield },
  { id: 3, name: "Decision", description: "ALLOW/REVIEW/DECLINE", icon: CheckCircle2 },
  { id: 4, name: "Execution", description: "State transition", icon: Activity },
  { id: 5, name: "Ledger", description: "Financial posting", icon: Database },
  { id: 6, name: "Evidence", description: "Audit pack generated", icon: FileCheck },
];

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
  const testPercentage = (module.testsPassing / module.testsTotal) * 100;

  return (
    <Card className="glass-panel hover:border-primary/40 transition-all group">
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
}

function DecisionFlowVisualization() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Decision Flow
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
            
            return (
              <div key={step.id} className="flex items-center">
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

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Live Decisions
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
              <div
                key={decision.decisionId}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors"
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
  const { data: summary, isLoading } = trpc.governance.getSystemSummary.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <Card className="glass-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Modules</p>
              <p className="text-2xl font-bold">{summary?.totalModules || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {summary?.allGreen ? "All GREEN" : "Check status"}
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tests</p>
              <p className="text-2xl font-bold">{summary?.passingTests || 0}/{summary?.totalTests || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
          <Progress value={summary ? (summary.passingTests / summary.totalTests) * 100 : 0} className="h-1.5 mt-3" />
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Decisions</p>
              <p className="text-2xl font-bold">{summary?.decisions.total || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-emerald-400">{summary?.decisions.allowed || 0} allowed</span>
            <span className="text-amber-400">{summary?.decisions.reviewed || 0} review</span>
            <span className="text-red-400">{summary?.decisions.declined || 0} declined</span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Release</p>
              <p className="text-lg font-bold font-mono">{summary?.releaseTag || "N/A"}</p>
            </div>
            <div className="p-3 rounded-full bg-violet-500/10">
              <Lock className="h-5 w-5 text-violet-500" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {summary?.allFrozen ? "All surfaces frozen" : "Surfaces open"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemOverview() {
  const { data: modules, isLoading: modulesLoading } = trpc.governance.listModules.useQuery();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Turing Protocol
              </h1>
              <p className="text-muted-foreground">System Governance Dashboard</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <SystemSummaryHeader />

        {/* Decision Flow */}
        <div className="mb-8">
          <DecisionFlowVisualization />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Modules Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Production Modules
            </h2>
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

          {/* Live Feed */}
          <div>
            <LiveDecisionFeed />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>All surfaces frozen • v1.0-replacement-ready</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/evidence">
                <Button variant="link" size="sm" className="text-muted-foreground hover:text-foreground">
                  Evidence Vault
                </Button>
              </Link>
              <Link href="/governance">
                <Button variant="link" size="sm" className="text-muted-foreground hover:text-foreground">
                  Governance Controls
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
