import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  Users,
  GitBranch,
  FileText,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Database,
  CreditCard,
  Wallet,
  Building2,
  TrendingUp,
} from "lucide-react";

// Module freeze status
const moduleStatus = [
  {
    id: "resolve",
    name: "Resolve",
    icon: Shield,
    status: "FROZEN",
    freezeDate: "2024-12-01",
    tests: 45,
    codeowners: ["@turing/governance-council", "@turing/core-platform"],
    lastChange: "2024-12-16",
    ciGate: "BLOCKING",
  },
  {
    id: "ledger",
    name: "Ledger",
    icon: Database,
    status: "FROZEN",
    freezeDate: "2024-12-01",
    tests: 32,
    codeowners: ["@turing/governance-council", "@turing/core-platform"],
    lastChange: "2024-12-10",
    ciGate: "BLOCKING",
  },
  {
    id: "lending",
    name: "Lending",
    icon: CreditCard,
    status: "FROZEN",
    freezeDate: "2024-12-10",
    tests: 38,
    codeowners: ["@turing/governance-council", "@turing/lending-team"],
    lastChange: "2024-12-15",
    ciGate: "BLOCKING",
  },
  {
    id: "payments",
    name: "Payments",
    icon: Wallet,
    status: "FROZEN",
    freezeDate: "2024-12-15",
    tests: 49,
    codeowners: ["@turing/governance-council", "@turing/payments-team"],
    lastChange: "2024-12-16",
    ciGate: "BLOCKING",
  },
  {
    id: "exposure",
    name: "Exposure",
    icon: TrendingUp,
    status: "FROZEN",
    freezeDate: "2024-12-16",
    tests: 65,
    codeowners: ["@turing/governance-council", "@turing/risk-team"],
    lastChange: "2024-12-16",
    ciGate: "BLOCKING",
  },
  {
    id: "deposits",
    name: "Deposits",
    icon: Building2,
    status: "FROZEN",
    freezeDate: "2024-12-16",
    tests: 18,
    codeowners: ["@turing/governance-council", "@turing/deposits-team"],
    lastChange: "2024-12-16",
    ciGate: "BLOCKING",
  },
];

// Governance exceptions (none currently)
const exceptions: Array<{
  id: string;
  module: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  expiresAt: string | null;
}> = [];

// Absolute boundaries
const boundaries = [
  {
    id: "NO_NEW_DOMAINS",
    title: "No New Execution Domains",
    description: "All 6 domains (Resolve, Ledger, Lending, Payments, Exposure, Deposits) are frozen. New domains require governance exception and board approval.",
    status: "ENFORCED",
    enforcedBy: "CODEOWNERS + CI Gate",
  },
  {
    id: "NO_LEDGER_CHANGES",
    title: "No Ledger Schema Changes",
    description: "Ledger is the sole source of financial truth. Any schema change invalidates all replay proofs and requires full re-certification.",
    status: "ENFORCED",
    enforcedBy: "CODEOWNERS + Migration Lock",
  },
  {
    id: "NO_EXECUTION_LOGIC",
    title: "No Execution Logic Outside Resolve",
    description: "All business decisions must flow through Resolve. Execution modules contain no decision logic - only state machines gated by Resolve.",
    status: "ENFORCED",
    enforcedBy: "Architecture Review + CI Gate",
  },
  {
    id: "NO_ML_WITHOUT_WRAPPER",
    title: "No ML Decisions Without Governance Wrappers",
    description: "ML model outputs are facts, not decisions. Resolve must evaluate ML facts against policies before any execution.",
    status: "ENFORCED",
    enforcedBy: "Architecture Review + Policy Requirement",
  },
];

// Internal declarations
const declarations = [
  {
    id: "DECL-001",
    date: "2024-12-16",
    module: "SYSTEM",
    declaration: "The current system is v1 of a category, not a prototype. Treat it accordingly.",
    author: "Governance Council",
  },
  {
    id: "DECL-002",
    date: "2024-12-16",
    module: "PAYMENTS",
    declaration: "Payments surface is frozen. All future changes require governance exception.",
    author: "Governance Council",
  },
  {
    id: "DECL-003",
    date: "2024-12-16",
    module: "EXPOSURE",
    declaration: "Exposure surface is frozen (Facts-only). All future changes require governance exception.",
    author: "Governance Council",
  },
  {
    id: "DECL-004",
    date: "2024-12-16",
    module: "DEPOSITS",
    declaration: "Deposits surface is frozen (Replacement-Grade). All future changes require governance exception.",
    author: "Governance Council",
  },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    FROZEN: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Lock },
    ENFORCED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    BLOCKING: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: Shield },
    PENDING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertCircle },
    APPROVED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    REJECTED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  };

  const { color, icon: Icon } = config[status] || { color: "bg-gray-500/20 text-gray-400", icon: AlertCircle };

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ModuleFreezeTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Module Surface Freeze Status
        </CardTitle>
        <CardDescription>All execution modules are frozen with CI gates blocking changes</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Freeze Date</TableHead>
              <TableHead>Tests</TableHead>
              <TableHead>CI Gate</TableHead>
              <TableHead>CODEOWNERS</TableHead>
              <TableHead>Last Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleStatus.map((module) => {
              const Icon = module.icon;
              return (
                <TableRow key={module.id} className="hover:bg-secondary/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{module.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={module.status} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(module.freezeDate)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-emerald-400">{module.tests}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={module.ciGate} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {module.codeowners.map((owner) => (
                        <Badge key={owner} variant="secondary" className="text-xs">
                          {owner}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(module.lastChange)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BoundariesCard() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Absolute Boundaries
        </CardTitle>
        <CardDescription>System-wide governance constraints that cannot be bypassed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {boundaries.map((boundary) => (
            <div
              key={boundary.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border/50"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{boundary.title}</h4>
                <StatusBadge status={boundary.status} />
              </div>
              <p className="text-sm text-muted-foreground mb-2">{boundary.description}</p>
              <p className="text-xs text-primary">
                Enforced by: {boundary.enforcedBy}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExceptionsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Governance Exceptions
            </CardTitle>
            <CardDescription>Active and pending exception requests</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Request Exception
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exceptions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Exceptions</h3>
            <p className="text-sm text-muted-foreground">
              All modules are operating under standard governance rules.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exception ID</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell className="font-mono">{exception.id}</TableCell>
                  <TableCell>{exception.module}</TableCell>
                  <TableCell>{exception.reason}</TableCell>
                  <TableCell>{exception.requestedBy}</TableCell>
                  <TableCell>
                    <StatusBadge status={exception.status} />
                  </TableCell>
                  <TableCell>
                    {exception.expiresAt ? formatDate(exception.expiresAt) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DeclarationsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Internal Declarations
        </CardTitle>
        <CardDescription>Official governance statements and commitments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {declarations.map((decl) => (
            <div
              key={decl.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{decl.module}</Badge>
                  <span className="text-xs text-muted-foreground">{decl.id}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(decl.date)}</span>
              </div>
              <p className="text-sm italic text-foreground">"{decl.declaration}"</p>
              <p className="text-xs text-muted-foreground mt-2">— {decl.author}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseInfo() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Release Information
        </CardTitle>
        <CardDescription>Current production release and version control</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="font-medium mb-2">Current Release</h4>
            <p className="font-mono text-lg text-primary">v1.0-replacement-ready</p>
            <p className="text-xs text-muted-foreground mt-1">Tagged 2024-12-16</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Branch</h4>
            <p className="font-mono text-lg">main</p>
            <p className="text-xs text-muted-foreground mt-1">Protected branch</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium text-emerald-400">Diligence Ready</span>
          </div>
          <p className="text-sm text-muted-foreground">
            This release is frozen and ready for CU board, regulator, PE diligence, and risk/compliance review.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            View on GitHub
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Download Proof Pack
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GovernanceControls() {
  const totalTests = moduleStatus.reduce((sum, m) => sum + m.tests, 0);
  const allFrozen = moduleStatus.every((m) => m.status === "FROZEN");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Governance Controls</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            System surface freeze and compliance management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allFrozen && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
              <Lock className="h-3 w-3" />
              All Surfaces Frozen
            </Badge>
          )}
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {totalTests} Tests Passing
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="freeze" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="freeze">Surface Freeze</TabsTrigger>
          <TabsTrigger value="boundaries">Boundaries</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          <TabsTrigger value="declarations">Declarations</TabsTrigger>
          <TabsTrigger value="release">Release</TabsTrigger>
        </TabsList>

        <TabsContent value="freeze">
          <ModuleFreezeTable />
        </TabsContent>

        <TabsContent value="boundaries">
          <BoundariesCard />
        </TabsContent>

        <TabsContent value="exceptions">
          <ExceptionsTable />
        </TabsContent>

        <TabsContent value="declarations">
          <DeclarationsTable />
        </TabsContent>

        <TabsContent value="release">
          <ReleaseInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
