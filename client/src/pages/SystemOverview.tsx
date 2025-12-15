import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Module data
const modules = [
  {
    id: "resolve",
    name: "Resolve",
    description: "Decision Governance Engine",
    icon: Shield,
    status: "GREEN",
    tests: { passed: 45, total: 45 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["Policy Evaluation", "Decision Audit", "Explainability"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "ledger",
    name: "Ledger",
    description: "Double-Entry Accounting",
    icon: Database,
    status: "GREEN",
    tests: { passed: 32, total: 32 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["Immutable Postings", "Balance Derivation", "Reversals"],
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "lending",
    name: "Lending",
    description: "Loan Lifecycle Management",
    icon: CreditCard,
    status: "GREEN",
    tests: { passed: 38, total: 38 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["State Machine", "Resolve Gate", "Evidence Packs"],
    color: "from-emerald-500 to-green-500",
  },
  {
    id: "payments",
    name: "Payments",
    description: "Payment Processing",
    icon: Wallet,
    status: "GREEN",
    tests: { passed: 49, total: 49 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["State Machine", "Event Sourcing", "Replay Proof"],
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "exposure",
    name: "Exposure",
    description: "Limits & Risk Aggregation",
    icon: TrendingUp,
    status: "GREEN",
    tests: { passed: 65, total: 65 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["AU v1 Limits", "Snapshot Projection", "Gate Enforcement"],
    color: "from-rose-500 to-pink-500",
  },
  {
    id: "deposits",
    name: "Deposits",
    description: "Account & Balance Management",
    icon: Building2,
    status: "GREEN",
    tests: { passed: 18, total: 18 },
    lastVerified: "2024-12-16T18:00:00Z",
    capabilities: ["Holds Engine", "Interest/Fees", "Statements"],
    color: "from-sky-500 to-blue-500",
  },
];

// Decision flow steps
const decisionFlow = [
  { id: 1, name: "Request", description: "Action requested", icon: Zap },
  { id: 2, name: "Resolve", description: "Policy evaluation", icon: Shield },
  { id: 3, name: "Decision", description: "ALLOW/REVIEW/DECLINE", icon: CheckCircle2 },
  { id: 4, name: "Execution", description: "State transition", icon: Activity },
  { id: 5, name: "Ledger", description: "Financial posting", icon: Database },
  { id: 6, name: "Evidence", description: "Audit pack generated", icon: FileCheck },
];

// Recent decisions for the live feed
const recentDecisions = [
  {
    id: "DEC-2024-001",
    type: "LENDING",
    action: "LOAN_APPROVAL",
    outcome: "ALLOW",
    timestamp: "2024-12-16T17:45:00Z",
    customer: "CUS-001",
    amount: 25000,
  },
  {
    id: "DEC-2024-002",
    type: "PAYMENTS",
    action: "PAYMENT_AUTHORISE",
    outcome: "ALLOW",
    timestamp: "2024-12-16T17:42:00Z",
    customer: "CUS-002",
    amount: 1500,
  },
  {
    id: "DEC-2024-003",
    type: "EXPOSURE",
    action: "LIMIT_CHECK",
    outcome: "DECLINE",
    timestamp: "2024-12-16T17:38:00Z",
    customer: "CUS-003",
    amount: 180000,
  },
  {
    id: "DEC-2024-004",
    type: "DEPOSITS",
    action: "HOLD_PLACEMENT",
    outcome: "ALLOW",
    timestamp: "2024-12-16T17:35:00Z",
    customer: "CUS-004",
    amount: 5000,
  },
  {
    id: "DEC-2024-005",
    type: "LENDING",
    action: "LOAN_DISBURSEMENT",
    outcome: "REVIEW",
    timestamp: "2024-12-16T17:30:00Z",
    customer: "CUS-005",
    amount: 75000,
  },
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

function ModuleCard({ module }: { module: typeof modules[0] }) {
  const Icon = module.icon;
  const testPercentage = (module.tests.passed / module.tests.total) * 100;

  return (
    <Card className="glass-panel hover:border-primary/30 transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${module.color} bg-opacity-20`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <StatusBadge status={module.status} />
        </div>
        <CardTitle className="text-lg mt-3">{module.name}</CardTitle>
        <CardDescription>{module.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tests</span>
            <span className="font-mono text-foreground">
              {module.tests.passed}/{module.tests.total}
            </span>
          </div>
          <Progress value={testPercentage} className="h-1.5" />
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {module.capabilities.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>

        <div className="pt-2 border-t border-border/50">
          <Link href={`/${module.id}`}>
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
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentDecisions.map((decision) => (
            <div
              key={decision.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-primary">{decision.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {decision.type} • {decision.action}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">
                  ${decision.amount.toLocaleString()}
                </span>
                <OutcomeBadge outcome={decision.outcome} />
                <Link href={`/decisions/${decision.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GovernanceStatus() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Governance Status
        </CardTitle>
        <CardDescription>System surface freeze and compliance status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Surface Frozen</span>
            </div>
            <p className="text-xs text-muted-foreground">All 6 modules locked</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">CI Gates Active</span>
            </div>
            <p className="text-xs text-muted-foreground">Blocking on all modules</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">CODEOWNERS</span>
            </div>
            <p className="text-xs text-muted-foreground">Governance approval required</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">No Exceptions</span>
            </div>
            <p className="text-xs text-muted-foreground">0 active exceptions</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm italic text-muted-foreground">
            "The current system is v1 of a category, not a prototype. Treat it accordingly."
          </p>
          <p className="text-xs text-primary mt-2 font-mono">
            Release: v1.0-replacement-ready
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemOverview() {
  const totalTests = modules.reduce((sum, m) => sum + m.tests.total, 0);
  const passedTests = modules.reduce((sum, m) => sum + m.tests.passed, 0);
  const allGreen = modules.every((m) => m.status === "GREEN");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Turing Protocol</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            System Governance Dashboard • v1.0-replacement-ready
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-400">
                {allGreen ? "All Systems GREEN" : "System Status"}
              </p>
              <p className="text-xs text-muted-foreground">
                {passedTests}/{totalTests} tests passing
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Module Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>

          {/* Decision Flow */}
          <DecisionFlowVisualization />
        </TabsContent>

        <TabsContent value="modules" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-6">
          <LiveDecisionFeed />
        </TabsContent>

        <TabsContent value="governance" className="space-y-6">
          <GovernanceStatus />
          
          {/* Governance Boundaries */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Absolute Boundaries</CardTitle>
              <CardDescription>
                System-wide governance constraints that cannot be bypassed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    No New Domains
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    All 6 domains are frozen. New domains require governance exception.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    No Ledger Changes
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Ledger is sole source of financial truth. Any change invalidates replay proofs.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    No Execution Logic Outside Resolve
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    All business decisions flow through Resolve. Execution modules contain no decision logic.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    No ML Without Governance Wrappers
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    ML outputs are facts, not decisions. Resolve must evaluate ML facts against policies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
