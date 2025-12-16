import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Database, 
  Download, 
  FileJson, 
  Search, 
  Copy,
  Shield,
  FileText,
  GitCommit,
  Filter,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Mock Evidence Data
const mockEvidence = [
  {
    id: "EV-2024-8821",
    type: "LEDGER_PROJECTION",
    entity: "ACC-9928-X",
    timestamp: "2024-12-16T10:45:00Z",
    hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    size: "2.4 KB",
    verified: true
  },
  {
    id: "EV-2024-8822",
    type: "EXTERNAL_FACT",
    entity: "KYC-USER-77",
    timestamp: "2024-12-16T10:45:01Z",
    hash: "sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    size: "12.8 KB",
    verified: true
  },
  {
    id: "EV-2024-8823",
    type: "POLICY_SNAPSHOT",
    entity: "POL-AML-001",
    timestamp: "2024-12-16T10:45:01Z",
    hash: "sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    size: "4.1 KB",
    verified: true
  },
  {
    id: "EV-2024-8824",
    type: "DECISION_TRACE",
    entity: "DEC-2024-001",
    timestamp: "2024-12-16T10:45:02Z",
    hash: "sha256:5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    size: "8.5 KB",
    verified: true
  },
  {
    id: "EV-2024-8825",
    type: "LEDGER_PROJECTION",
    entity: "ACC-1122-Y",
    timestamp: "2024-12-16T11:00:00Z",
    hash: "sha256:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    size: "3.1 KB",
    verified: true
  }
];

const typeConfig: Record<string, { icon: React.ReactNode; variant: "info" | "success" | "warning" | "muted" }> = {
  LEDGER_PROJECTION: { icon: <Database className="w-3 h-3" />, variant: "info" },
  EXTERNAL_FACT: { icon: <FileText className="w-3 h-3" />, variant: "muted" },
  POLICY_SNAPSHOT: { icon: <Shield className="w-3 h-3" />, variant: "warning" },
  DECISION_TRACE: { icon: <GitCommit className="w-3 h-3" />, variant: "success" }
};

export default function EvidenceVault() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredEvidence = mockEvidence.filter(item => {
    const matchesSearch = 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.hash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedType || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success("Hash copied to clipboard");
  };

  const handleExport = () => {
    toast.success("Audit package exported", { 
      description: `${filteredEvidence.length} evidence items included` 
    });
  };

  const uniqueTypes = Array.from(new Set(mockEvidence.map(e => e.type)));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Evidence Vault
          </h1>
          <p className="text-muted-foreground mt-1">
            Cryptographically verifiable audit trail of all inputs and decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast.info("Refreshing vault...")}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Audit Package
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Total Evidence</div>
          <div className="text-2xl font-bold mt-1">{mockEvidence.length}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Verified</div>
          <div className="text-2xl font-bold mt-1 text-success">
            {mockEvidence.filter(e => e.verified).length}
          </div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Total Size</div>
          <div className="text-2xl font-bold mt-1">
            {mockEvidence.reduce((acc, e) => acc + parseFloat(e.size), 0).toFixed(1)} KB
          </div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-muted-foreground">Latest Entry</div>
          <div className="text-lg font-semibold mt-1">
            {new Date(Math.max(...mockEvidence.map(e => new Date(e.timestamp).getTime()))).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by hash, entity ID, or type..."
            className="pl-9 bg-background/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Button
            variant={selectedType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(null)}
          >
            All
          </Button>
          {uniqueTypes.map(type => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
              className="gap-1"
            >
              {typeConfig[type]?.icon}
              {type.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      {/* Evidence Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Immutable Fact Store
          </h3>
          <span className="text-sm text-muted-foreground">
            {filteredEvidence.length} of {mockEvidence.length} entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Evidence ID</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Entity Reference</TableHead>
                <TableHead className="font-semibold">Timestamp</TableHead>
                <TableHead className="font-semibold">Content Hash (SHA-256)</TableHead>
                <TableHead className="font-semibold text-right">Size</TableHead>
                <TableHead className="font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvidence.map((item) => {
                const config = typeConfig[item.type] || { icon: null, variant: "muted" as const };
                return (
                  <TableRow key={item.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono font-medium">{item.id}</TableCell>
                    <TableCell>
                      <StatusBadge variant={config.variant}>
                        {config.icon}
                        {item.type.replace(/_/g, " ")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.entity}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="relative rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                          {item.hash.substring(7, 23)}...
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => handleCopyHash(item.hash)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {item.size}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toast.info("Viewing evidence", { description: item.id })}
                      >
                        <FileJson className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEvidence.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No evidence found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4">
        <span className="flex items-center gap-1">
          <kbd className="kbd">/</kbd>
          Search
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">E</kbd>
          Export
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">R</kbd>
          Refresh
        </span>
      </div>
    </div>
  );
}
