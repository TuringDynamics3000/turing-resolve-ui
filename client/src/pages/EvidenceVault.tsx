import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Download, FileJson, Search } from "lucide-react";
import { useState } from "react";

// Mock Evidence Data
const mockEvidence = [
  {
    id: "EV-2024-8821",
    type: "LEDGER_PROJECTION",
    entity: "ACC-9928-X",
    timestamp: "2024-12-16T10:45:00Z",
    hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    size: "2.4 KB"
  },
  {
    id: "EV-2024-8822",
    type: "EXTERNAL_FACT",
    entity: "KYC-USER-77",
    timestamp: "2024-12-16T10:45:01Z",
    hash: "sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    size: "12.8 KB"
  },
  {
    id: "EV-2024-8823",
    type: "POLICY_SNAPSHOT",
    entity: "POL-AML-001",
    timestamp: "2024-12-16T10:45:01Z",
    hash: "sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    size: "4.1 KB"
  },
  {
    id: "EV-2024-8824",
    type: "DECISION_TRACE",
    entity: "DEC-2024-001",
    timestamp: "2024-12-16T10:45:02Z",
    hash: "sha256:5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    size: "8.5 KB"
  }
];

export default function EvidenceVault() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence Vault</h1>
          <p className="text-muted-foreground">
            Cryptographically verifiable audit trail of all inputs and decisions.
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export Audit Package
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by hash, entity ID, or type..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Immutable Fact Store
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entity Reference</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Content Hash (SHA-256)</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockEvidence.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">{item.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.entity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(item.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs text-muted-foreground">
                      {item.hash.substring(0, 16)}...
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <FileJson className="h-4 w-4" />
                      <span className="sr-only">View JSON</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
