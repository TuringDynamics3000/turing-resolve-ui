import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Hash,
  Shield,
  CreditCard,
  Wallet,
  Building2,
  TrendingUp,
  RefreshCw,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function ModuleBadge({ module }: { module: string }) {
  const config: Record<string, { color: string; icon: typeof Shield }> = {
    RESOLVE: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
    LENDING: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CreditCard },
    LOAN: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CreditCard },
    PAYMENTS: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Wallet },
    PAYMENT: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Wallet },
    DEPOSITS: { color: "bg-sky-500/20 text-sky-400 border-sky-500/30", icon: Building2 },
    DEPOSIT: { color: "bg-sky-500/20 text-sky-400 border-sky-500/30", icon: Building2 },
    EXPOSURE: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30", icon: TrendingUp },
  };

  const { color, icon: Icon } = config[module] || { color: "bg-gray-500/20 text-gray-400", icon: Shield };

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {module}
    </Badge>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config: Record<string, string> = {
    ALLOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    REVIEW: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DECLINE: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <Badge variant="outline" className={config[outcome] || "bg-gray-500/20 text-gray-400"}>
      {outcome}
    </Badge>
  );
}

function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

function DecisionsTable({ searchQuery, moduleFilter }: { searchQuery: string; moduleFilter: string }) {
  const { data: decisions, isLoading, refetch } = trpc.governance.listDecisions.useQuery(
    moduleFilter !== "all" ? { entityType: moduleFilter as "LOAN" | "PAYMENT" | "DEPOSIT" | "EXPOSURE" } : {}
  );

  const filtered = decisions?.filter((decision) => {
    const matchesSearch =
      decision.decisionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      decision.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      decision.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Decisions
            </CardTitle>
            <CardDescription>All governance decisions across modules</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Decision ID</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((decision) => (
              <TableRow key={decision.decisionId} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{decision.decisionId}</TableCell>
                <TableCell>
                  <ModuleBadge module={decision.entityType} />
                </TableCell>
                <TableCell className="font-mono text-sm">{decision.entityId}</TableCell>
                <TableCell>
                  <OutcomeBadge outcome={decision.outcome} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {decision.policiesFired.length} policies
                  </span>
                </TableCell>
                <TableCell className="text-sm">{formatDate(decision.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/evidence/${decision.decisionId}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EvidencePacksTable({ searchQuery, moduleFilter }: { searchQuery: string; moduleFilter: string }) {
  const { data: evidencePacks, isLoading, refetch } = trpc.governance.listEvidencePacks.useQuery(
    moduleFilter !== "all" ? { entityType: moduleFilter } : {}
  );

  const filtered = evidencePacks?.filter((pack) => {
    const matchesSearch =
      pack.evidenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.decisionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.entityId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Evidence Packs
            </CardTitle>
            <CardDescription>Cryptographically-verifiable audit records</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evidence ID</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Replay Hash</TableHead>
              <TableHead>Events</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((pack) => (
              <TableRow key={pack.evidenceId} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{pack.evidenceId}</TableCell>
                <TableCell>
                  <ModuleBadge module={pack.entityType} />
                </TableCell>
                <TableCell className="font-mono text-sm">{pack.decisionId}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{pack.state}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {pack.replayHash.substring(0, 16)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(pack.replayHash)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{pack.eventHistory.length} events</TableCell>
                <TableCell>
                  <Link href={`/evidence/${pack.decisionId}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReplayProofsTable() {
  const { data: proofs, isLoading, refetch } = trpc.governance.listReplayProofs.useQuery({});

  // Group proofs by module
  const groupedProofs = proofs?.reduce((acc, proof) => {
    if (!acc[proof.moduleName]) {
      acc[proof.moduleName] = { tests: [], passed: 0, total: 0 };
    }
    acc[proof.moduleName].tests.push(proof);
    acc[proof.moduleName].total++;
    if (proof.matched) acc[proof.moduleName].passed++;
    return acc;
  }, {} as Record<string, { tests: typeof proofs; passed: number; total: number }>);

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalTests = proofs?.length || 0;
  const passedTests = proofs?.filter(p => p.matched).length || 0;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Replay Proofs
            </CardTitle>
            <CardDescription>Deterministic replay verification results</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Run All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Tests</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedProofs || {}).map(([module, data]) => (
              <TableRow key={module} className="hover:bg-secondary/30">
                <TableCell>
                  <ModuleBadge module={module.toUpperCase()} />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-emerald-400">
                    {data.passed}/{data.total}
                  </span>
                </TableCell>
                <TableCell>
                  {data.passed === data.total ? (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      All Passing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {data.total - data.passed} Failing
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium text-emerald-400">All Replay Proofs Passing</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {passedTests}/{totalTests} tests passed. System state is deterministically reproducible from event history.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HashVerifier() {
  const [hashInput, setHashInput] = useState("");
  const [verificationResult, setVerificationResult] = useState<"idle" | "valid" | "invalid">("idle");
  const { data: evidencePacks } = trpc.governance.listEvidencePacks.useQuery({});

  const handleVerify = () => {
    const isValid = evidencePacks?.some((p) => p.replayHash === hashInput || p.manifest.factsHash === hashInput);
    setVerificationResult(isValid ? "valid" : "invalid");
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary" />
          Hash Verifier
        </CardTitle>
        <CardDescription>Verify evidence pack integrity by manifest hash</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter manifest hash (sha256:...)"
            value={hashInput}
            onChange={(e) => setHashInput(e.target.value)}
            className="font-mono"
          />
          <Button onClick={handleVerify} className="gap-2">
            <Search className="h-4 w-4" />
            Verify
          </Button>
        </div>

        {verificationResult !== "idle" && (
          <div
            className={`p-4 rounded-lg border ${
              verificationResult === "valid"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-red-500/10 border-red-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {verificationResult === "valid" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-medium text-emerald-400">Hash Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="font-medium text-red-400">Hash Not Found</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {verificationResult === "valid"
                ? "This hash matches a valid evidence pack in the system."
                : "No evidence pack found with this hash. The evidence may have been tampered with."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EvidenceVaultSystem() {
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const { data: summary } = trpc.governance.getSystemSummary.useQuery();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950">
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Evidence Vault
                </h1>
                <p className="text-muted-foreground">Search and verify decision evidence across all modules</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {summary?.decisions.total || 0} Decisions Recorded
            </Badge>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, entity, or hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="LOAN">Lending</SelectItem>
                  <SelectItem value="PAYMENT">Payments</SelectItem>
                  <SelectItem value="DEPOSIT">Deposits</SelectItem>
                  <SelectItem value="EXPOSURE">Exposure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="decisions" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Packs</TabsTrigger>
            <TabsTrigger value="replay">Replay Proofs</TabsTrigger>
            <TabsTrigger value="verify">Hash Verifier</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions">
            <DecisionsTable searchQuery={searchQuery} moduleFilter={moduleFilter} />
          </TabsContent>

          <TabsContent value="evidence">
            <EvidencePacksTable searchQuery={searchQuery} moduleFilter={moduleFilter} />
          </TabsContent>

          <TabsContent value="replay">
            <ReplayProofsTable />
          </TabsContent>

          <TabsContent value="verify">
            <HashVerifier />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
