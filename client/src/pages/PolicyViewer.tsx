import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockPolicies } from "@/lib/mockData";
import { 
  Code, 
  Copy, 
  FileText, 
  GitBranch, 
  Search, 
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Loading skeleton
function PolicyViewerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <div className="h-10 w-40 bg-muted rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="h-96 bg-muted/30 rounded-lg" />
        <div className="lg:col-span-3 h-96 bg-muted/30 rounded-lg" />
      </div>
    </div>
  );
}

export default function PolicyViewer() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(mockPolicies[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedPolicy = mockPolicies.find(p => p.id === selectedPolicyId) || mockPolicies[0];

  const filteredPolicies = mockPolicies.filter(policy => 
    policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    policy.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopySource = () => {
    const source = `policy "${selectedPolicy.id}" {
  version = "${selectedPolicy.version}"
  mode    = "STRICT"

${selectedPolicy.rules.map(r => `  rule "${r.name}" {
    severity = ${r.severity}
    condition = ${r.logic}
  }`).join('\n\n')}
}`;
    navigator.clipboard.writeText(source);
    toast.success("Policy source copied to clipboard");
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return { variant: "destructive" as const, icon: <XCircle className="w-3 h-3" /> };
      case "HIGH":
        return { variant: "warning" as const, icon: <AlertTriangle className="w-3 h-3" /> };
      default:
        return { variant: "muted" as const, icon: <CheckCircle2 className="w-3 h-3" /> };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Policy Governance
          </h1>
          <p className="text-muted-foreground mt-1">
            Review active decision logic and version history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast.info("Compare versions", { description: "Feature coming soon" })}>
            <GitBranch className="mr-2 h-4 w-4" />
            Compare Versions
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Active Policies</div>
          <div className="text-2xl font-bold mt-1">{mockPolicies.filter(p => p.status === "ACTIVE").length}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Total Rules</div>
          <div className="text-2xl font-bold mt-1">{mockPolicies.reduce((acc, p) => acc + p.rules.length, 0)}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Critical Rules</div>
          <div className="text-2xl font-bold mt-1 text-destructive">
            {mockPolicies.reduce((acc, p) => acc + p.rules.filter(r => r.severity === "CRITICAL").length, 0)}
          </div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Last Updated</div>
          <div className="text-lg font-semibold mt-1">
            {new Date(Math.max(...mockPolicies.map(p => new Date(p.last_updated).getTime()))).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar: Policy List */}
        <div className="glass-panel lg:col-span-1 h-fit">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold text-sm mb-3">Active Policies</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
          </div>
          <div className="flex flex-col max-h-[500px] overflow-y-auto">
            {filteredPolicies.map((policy) => (
              <button
                key={policy.id}
                onClick={() => setSelectedPolicyId(policy.id)}
                className={cn(
                  "flex items-start gap-3 p-4 text-left transition-all hover:bg-muted/50 border-l-4",
                  selectedPolicyId === policy.id 
                    ? "bg-muted/30 border-l-primary" 
                    : "border-l-transparent"
                )}
              >
                <Shield className={cn(
                  "h-5 w-5 mt-0.5 shrink-0",
                  selectedPolicyId === policy.id ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{policy.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5 font-mono">{policy.version}</Badge>
                    <span className="truncate">{policy.id}</span>
                  </div>
                </div>
              </button>
            ))}
            {filteredPolicies.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No policies found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Main Content: Policy Detail */}
        <div className="glass-panel lg:col-span-3">
          <div className="p-6 border-b border-border/50">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold">{selectedPolicy.name}</h2>
                  <StatusBadge variant="success">{selectedPolicy.status}</StatusBadge>
                  <Badge variant="outline" className="font-mono">{selectedPolicy.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedPolicy.description}</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 lg:text-right shrink-0">
                <div>Last Updated: <span className="text-foreground">{new Date(selectedPolicy.last_updated).toLocaleDateString()}</span></div>
                <div>Author: <span className="text-foreground">{selectedPolicy.author}</span></div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Rules Table */}
            <div>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                Logic Rules ({selectedPolicy.rules.length})
              </h3>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[100px] font-semibold">ID</TableHead>
                      <TableHead className="w-[200px] font-semibold">Rule Name</TableHead>
                      <TableHead className="font-semibold">Logic Expression</TableHead>
                      <TableHead className="text-right font-semibold w-[120px]">Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPolicy.rules.map((rule) => {
                      const severityConfig = getSeverityConfig(rule.severity);
                      return (
                        <TableRow key={rule.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs text-muted-foreground">{rule.id}</TableCell>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>
                            <code className="relative rounded bg-muted/50 px-2 py-1 font-mono text-xs">
                              {rule.logic}
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge variant={severityConfig.variant}>
                              {severityConfig.icon}
                              {rule.severity}
                            </StatusBadge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Source Definition */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Source Definition</h4>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCopySource}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <pre className="text-xs font-mono overflow-x-auto p-4 bg-background/50 text-muted-foreground">
                <code>{`policy "${selectedPolicy.id}" {
  version = "${selectedPolicy.version}"
  mode    = "STRICT"

${selectedPolicy.rules.map(r => `  rule "${r.name}" {
    severity = ${r.severity}
    condition = ${r.logic}
  }`).join('\n\n')}
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4">
        <span className="flex items-center gap-1">
          <kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">/</kbd>
          Search
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">C</kbd>
          Copy Source
        </span>
      </div>
    </div>
  );
}
