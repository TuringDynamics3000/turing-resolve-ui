import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Evidence pack data
const evidencePacks = [
  {
    id: "EVP-LEND-001",
    module: "LENDING",
    decisionId: "DEC-LEND-001",
    type: "LOAN_APPROVAL",
    customerId: "CUS-001",
    customerName: "Sarah Johnson",
    timestamp: "2024-12-16T10:30:00Z",
    manifestHash: "sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    verified: true,
    components: ["facts", "policies", "decision", "ledger_request", "state_transition"],
  },
  {
    id: "EVP-PAY-001",
    module: "PAYMENTS",
    decisionId: "DEC-PAY-001",
    type: "PAYMENT_AUTHORISE",
    customerId: "CUS-001",
    customerName: "Sarah Johnson",
    timestamp: "2024-12-16T14:00:00Z",
    manifestHash: "sha256:b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1",
    verified: true,
    components: ["facts", "policies", "decision", "event_chain", "ledger_request"],
  },
  {
    id: "EVP-DEP-001",
    module: "DEPOSITS",
    decisionId: "DEC-DEP-001",
    type: "HOLD_PLACEMENT",
    customerId: "CUS-002",
    customerName: "Michael Chen",
    timestamp: "2024-12-15T09:15:00Z",
    manifestHash: "sha256:c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2",
    verified: true,
    components: ["facts", "policies", "decision", "hold_event", "balance_snapshot"],
  },
  {
    id: "EVP-EXP-001",
    module: "EXPOSURE",
    decisionId: "DEC-EXP-001",
    type: "LIMIT_BREACH_DECLINE",
    customerId: "CUS-003",
    customerName: "Emily Williams",
    timestamp: "2024-12-16T11:15:00Z",
    manifestHash: "sha256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3",
    verified: true,
    components: ["exposure_snapshot", "limit_policies", "decision", "explanation"],
  },
  {
    id: "EVP-LEND-002",
    module: "LENDING",
    decisionId: "DEC-LEND-002",
    type: "LOAN_DISBURSEMENT",
    customerId: "CUS-004",
    customerName: "James Rodriguez",
    timestamp: "2024-12-14T14:20:00Z",
    manifestHash: "sha256:e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3d4",
    verified: true,
    components: ["facts", "policies", "decision", "ledger_posting", "state_transition"],
  },
  {
    id: "EVP-PAY-002",
    module: "PAYMENTS",
    decisionId: "DEC-PAY-002",
    type: "PAYMENT_REVERSAL",
    customerId: "CUS-005",
    customerName: "Lisa Thompson",
    timestamp: "2024-12-15T10:00:00Z",
    manifestHash: "sha256:f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3d4e5",
    verified: true,
    components: ["facts", "policies", "decision", "reversal_event", "ledger_reversal"],
  },
];

// Replay proofs
const replayProofs = [
  {
    id: "REPLAY-001",
    module: "LENDING",
    description: "Loan state machine replay",
    testsRun: 21,
    testsPassed: 21,
    timestamp: "2024-12-16T18:00:00Z",
    beforeHash: "sha256:abc123...",
    afterHash: "sha256:abc123...",
    match: true,
  },
  {
    id: "REPLAY-002",
    module: "PAYMENTS",
    description: "Payment event chain replay",
    testsRun: 16,
    testsPassed: 16,
    timestamp: "2024-12-16T18:00:00Z",
    beforeHash: "sha256:def456...",
    afterHash: "sha256:def456...",
    match: true,
  },
  {
    id: "REPLAY-003",
    module: "DEPOSITS",
    description: "Deposits lifecycle replay",
    testsRun: 18,
    testsPassed: 18,
    timestamp: "2024-12-16T18:00:00Z",
    beforeHash: "sha256:ghi789...",
    afterHash: "sha256:ghi789...",
    match: true,
  },
  {
    id: "REPLAY-004",
    module: "EXPOSURE",
    description: "Exposure projection replay",
    testsRun: 18,
    testsPassed: 18,
    timestamp: "2024-12-16T18:00:00Z",
    beforeHash: "sha256:jkl012...",
    afterHash: "sha256:jkl012...",
    match: true,
  },
];

function ModuleBadge({ module }: { module: string }) {
  const config: Record<string, { color: string; icon: typeof Shield }> = {
    RESOLVE: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
    LENDING: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CreditCard },
    PAYMENTS: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Wallet },
    DEPOSITS: { color: "bg-sky-500/20 text-sky-400 border-sky-500/30", icon: Building2 },
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
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

function EvidencePacksTable({ searchQuery, moduleFilter }: { searchQuery: string; moduleFilter: string }) {
  const filtered = evidencePacks.filter((pack) => {
    const matchesSearch =
      pack.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.decisionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.customerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === "all" || pack.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Evidence Packs
            </CardTitle>
            <CardDescription>Cryptographically-verifiable audit records</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pack ID</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Manifest Hash</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((pack) => (
              <TableRow key={pack.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{pack.id}</TableCell>
                <TableCell>
                  <ModuleBadge module={pack.module} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{pack.type.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{pack.customerName}</p>
                    <p className="text-xs text-muted-foreground">{pack.customerId}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{formatDate(pack.timestamp)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {pack.manifestHash.substring(0, 20)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(pack.manifestHash)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {pack.verified ? (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Invalid
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/evidence/${pack.id}`}>
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
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Replay Proofs
            </CardTitle>
            <CardDescription>Deterministic replay verification results</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Run All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proof ID</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tests</TableHead>
              <TableHead>Before Hash</TableHead>
              <TableHead>After Hash</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replayProofs.map((proof) => (
              <TableRow key={proof.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{proof.id}</TableCell>
                <TableCell>
                  <ModuleBadge module={proof.module} />
                </TableCell>
                <TableCell>{proof.description}</TableCell>
                <TableCell>
                  <span className="font-mono text-emerald-400">
                    {proof.testsPassed}/{proof.testsRun}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {proof.beforeHash}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {proof.afterHash}
                </TableCell>
                <TableCell>
                  {proof.match ? (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Match
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Mismatch
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
            73/73 tests passed. System state is deterministically reproducible from event history.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HashVerifier() {
  const [hashInput, setHashInput] = useState("");
  const [verificationResult, setVerificationResult] = useState<"idle" | "valid" | "invalid">("idle");

  const handleVerify = () => {
    // Simulate verification
    const isValid = evidencePacks.some((p) => p.manifestHash === hashInput);
    setVerificationResult(isValid ? "valid" : "invalid");
  };

  return (
    <Card className="glass-panel">
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Evidence Vault</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Search and verify decision evidence across all modules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {evidencePacks.length} Evidence Packs
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="glass-panel">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, decision, customer..."
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
                <SelectItem value="LENDING">Lending</SelectItem>
                <SelectItem value="PAYMENTS">Payments</SelectItem>
                <SelectItem value="DEPOSITS">Deposits</SelectItem>
                <SelectItem value="EXPOSURE">Exposure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="evidence" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="evidence">Evidence Packs</TabsTrigger>
          <TabsTrigger value="replay">Replay Proofs</TabsTrigger>
          <TabsTrigger value="verify">Hash Verifier</TabsTrigger>
        </TabsList>

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
  );
}
