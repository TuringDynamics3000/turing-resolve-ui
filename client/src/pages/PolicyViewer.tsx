import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockPolicies } from "@/lib/mockData";
import { Code, FileText, GitBranch, Shield } from "lucide-react";
import { useState } from "react";

export default function PolicyViewer() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(mockPolicies[0].id);
  const selectedPolicy = mockPolicies.find(p => p.id === selectedPolicyId) || mockPolicies[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policy Governance</h1>
          <p className="text-muted-foreground">
            Review active decision logic and version history.
          </p>
        </div>
        <Button variant="outline">
          <GitBranch className="mr-2 h-4 w-4" />
          Compare Versions
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar: Policy List */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {mockPolicies.map((policy) => (
                <button
                  key={policy.id}
                  onClick={() => setSelectedPolicyId(policy.id)}
                  className={`flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${
                    selectedPolicyId === policy.id ? "bg-muted border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                  }`}
                >
                  <Shield className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{policy.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-5">{policy.version}</Badge>
                      <span>{policy.id}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content: Policy Detail */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {selectedPolicy.name}
                <Badge className="ml-2 bg-green-600 hover:bg-green-700">{selectedPolicy.status}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{selectedPolicy.description}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Last Updated: {new Date(selectedPolicy.last_updated).toLocaleDateString()}</div>
              <div>Author: {selectedPolicy.author}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                <Code className="h-4 w-4" />
                Logic Rules
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead className="w-[200px]">Rule Name</TableHead>
                    <TableHead>Logic Expression</TableHead>
                    <TableHead className="text-right">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPolicy.rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-xs">{rule.id}</TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                          {rule.logic}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={
                          rule.severity === 'CRITICAL' ? 'destructive' :
                          rule.severity === 'HIGH' ? 'default' : 'secondary'
                        }>
                          {rule.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Source Definition</h4>
              </div>
              <pre className="text-xs font-mono overflow-x-auto p-2 bg-background rounded border">
{`policy "${selectedPolicy.id}" {
  version = "${selectedPolicy.version}"
  mode    = "STRICT"

${selectedPolicy.rules.map(r => `  rule "${r.name}" {
    severity = ${r.severity}
    condition = ${r.logic}
  }`).join('\n\n')}
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
