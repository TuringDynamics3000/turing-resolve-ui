import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  Shield,
  Zap,
  ChevronRight,
  Equal,
  Minus,
  Plus,
} from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

// Types
interface Decision {
  id: string;
  decision_id: string;
  request_type: string;
  outcome: "APPROVED" | "REJECTED" | "REVIEW";
  risk_score: number;
  timestamp: Date;
  policy_version: string;
  applicant_id: string;
  amount?: number;
  rules_evaluated: number;
  rules_triggered: string[];
  latency_ms: number;
  confidence: number;
}

interface ComparisonResult {
  field: string;
  label: string;
  decision1: string | number;
  decision2: string | number;
  difference: "same" | "different" | "higher" | "lower";
}

// Mock decisions data
const mockDecisions: Decision[] = [
  {
    id: "1",
    decision_id: "DEC-2024-001234",
    request_type: "LOAN_APPLICATION",
    outcome: "APPROVED",
    risk_score: 0.23,
    timestamp: new Date("2024-12-17T10:30:00"),
    policy_version: "v2.3.1",
    applicant_id: "APP-9876",
    amount: 50000,
    rules_evaluated: 47,
    rules_triggered: ["credit_score_check", "income_verification", "debt_ratio"],
    latency_ms: 145,
    confidence: 0.94,
  },
  {
    id: "2",
    decision_id: "DEC-2024-001235",
    request_type: "LOAN_APPLICATION",
    outcome: "REJECTED",
    risk_score: 0.78,
    timestamp: new Date("2024-12-17T10:45:00"),
    policy_version: "v2.3.1",
    applicant_id: "APP-9877",
    amount: 75000,
    rules_evaluated: 47,
    rules_triggered: ["credit_score_check", "income_verification", "debt_ratio", "fraud_flag", "high_risk_region"],
    latency_ms: 167,
    confidence: 0.89,
  },
  {
    id: "3",
    decision_id: "DEC-2024-001236",
    request_type: "CREDIT_LIMIT_INCREASE",
    outcome: "REVIEW",
    risk_score: 0.52,
    timestamp: new Date("2024-12-17T11:00:00"),
    policy_version: "v2.3.0",
    applicant_id: "APP-9878",
    amount: 25000,
    rules_evaluated: 35,
    rules_triggered: ["credit_utilization", "payment_history"],
    latency_ms: 98,
    confidence: 0.71,
  },
  {
    id: "4",
    decision_id: "DEC-2024-001237",
    request_type: "LOAN_APPLICATION",
    outcome: "APPROVED",
    risk_score: 0.15,
    timestamp: new Date("2024-12-17T11:15:00"),
    policy_version: "v2.3.1",
    applicant_id: "APP-9879",
    amount: 30000,
    rules_evaluated: 47,
    rules_triggered: ["credit_score_check", "income_verification"],
    latency_ms: 132,
    confidence: 0.97,
  },
];

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config = {
    APPROVED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    REJECTED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
    REVIEW: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  }[outcome] || { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: AlertTriangle };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {outcome}
    </Badge>
  );
}

function DifferenceIndicator({ difference }: { difference: ComparisonResult["difference"] }) {
  switch (difference) {
    case "same":
      return <Equal className="h-4 w-4 text-muted-foreground" />;
    case "different":
      return <ArrowLeftRight className="h-4 w-4 text-amber-400" />;
    case "higher":
      return <Plus className="h-4 w-4 text-red-400" />;
    case "lower":
      return <Minus className="h-4 w-4 text-emerald-400" />;
  }
}

function compareDecisions(d1: Decision, d2: Decision): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  // Outcome
  results.push({
    field: "outcome",
    label: "Outcome",
    decision1: d1.outcome,
    decision2: d2.outcome,
    difference: d1.outcome === d2.outcome ? "same" : "different",
  });

  // Risk Score
  results.push({
    field: "risk_score",
    label: "Risk Score",
    decision1: (d1.risk_score * 100).toFixed(1) + "%",
    decision2: (d2.risk_score * 100).toFixed(1) + "%",
    difference: d1.risk_score === d2.risk_score ? "same" : d1.risk_score > d2.risk_score ? "lower" : "higher",
  });

  // Policy Version
  results.push({
    field: "policy_version",
    label: "Policy Version",
    decision1: d1.policy_version,
    decision2: d2.policy_version,
    difference: d1.policy_version === d2.policy_version ? "same" : "different",
  });

  // Rules Evaluated
  results.push({
    field: "rules_evaluated",
    label: "Rules Evaluated",
    decision1: d1.rules_evaluated,
    decision2: d2.rules_evaluated,
    difference: d1.rules_evaluated === d2.rules_evaluated ? "same" : "different",
  });

  // Rules Triggered
  results.push({
    field: "rules_triggered",
    label: "Rules Triggered",
    decision1: d1.rules_triggered.length,
    decision2: d2.rules_triggered.length,
    difference: d1.rules_triggered.length === d2.rules_triggered.length ? "same" : d1.rules_triggered.length > d2.rules_triggered.length ? "lower" : "higher",
  });

  // Confidence
  results.push({
    field: "confidence",
    label: "Confidence",
    decision1: (d1.confidence * 100).toFixed(1) + "%",
    decision2: (d2.confidence * 100).toFixed(1) + "%",
    difference: d1.confidence === d2.confidence ? "same" : d1.confidence > d2.confidence ? "lower" : "higher",
  });

  // Latency
  results.push({
    field: "latency_ms",
    label: "Latency",
    decision1: d1.latency_ms + "ms",
    decision2: d2.latency_ms + "ms",
    difference: d1.latency_ms === d2.latency_ms ? "same" : d1.latency_ms > d2.latency_ms ? "lower" : "higher",
  });

  // Amount
  if (d1.amount && d2.amount) {
    results.push({
      field: "amount",
      label: "Amount",
      decision1: "$" + d1.amount.toLocaleString(),
      decision2: "$" + d2.amount.toLocaleString(),
      difference: d1.amount === d2.amount ? "same" : "different",
    });
  }

  return results;
}

export default function CompareDecisions() {
  const [selectedDecisions, setSelectedDecisions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[] | null>(null);

  const filteredDecisions = mockDecisions.filter((d) => {
    const matchesSearch = d.decision_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.applicant_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || d.request_type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSelectDecision = (id: string) => {
    setSelectedDecisions((prev) => {
      if (prev.includes(id)) {
        return prev.filter((d) => d !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedDecisions.length === 2) {
      const d1 = mockDecisions.find((d) => d.id === selectedDecisions[0]);
      const d2 = mockDecisions.find((d) => d.id === selectedDecisions[1]);
      if (d1 && d2) {
        setComparisonResults(compareDecisions(d1, d2));
      }
    }
  };

  const selectedDecisionObjects = selectedDecisions.map((id) => mockDecisions.find((d) => d.id === id)).filter(Boolean) as Decision[];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20">
            <GitCompare className="h-8 w-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              Compare Decisions
            </h1>
            <p className="text-muted-foreground">Side-by-side analysis of decision outcomes and policy differences</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Decision Selection Panel */}
          <div className="lg:col-span-1">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Select Decisions
                </CardTitle>
                <CardDescription>Choose two decisions to compare</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search & Filter */}
                <div className="space-y-2">
                  <Input
                    placeholder="Search by ID or applicant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-secondary/30"
                  />
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="bg-secondary/30">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="LOAN_APPLICATION">Loan Application</SelectItem>
                      <SelectItem value="CREDIT_LIMIT_INCREASE">Credit Limit Increase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Decision List */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedDecisions.includes(decision.id)
                            ? "border-violet-500/50 bg-violet-500/10"
                            : "border-border hover:border-violet-500/30 bg-secondary/20"
                        }`}
                        onClick={() => handleSelectDecision(decision.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedDecisions.includes(decision.id)}
                              onCheckedChange={() => handleSelectDecision(decision.id)}
                            />
                            <span className="font-mono text-sm">{decision.decision_id}</span>
                          </div>
                          <OutcomeBadge outcome={decision.outcome} />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 ml-6">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {format(decision.timestamp, "MMM d, HH:mm")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            Risk: {(decision.risk_score * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Compare Button */}
                <Button
                  className="w-full"
                  disabled={selectedDecisions.length !== 2}
                  onClick={handleCompare}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Selected ({selectedDecisions.length}/2)
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Results */}
          <div className="lg:col-span-2">
            {comparisonResults && selectedDecisionObjects.length === 2 ? (
              <div className="space-y-6">
                {/* Side-by-Side Headers */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedDecisionObjects.map((decision, index) => (
                    <Card key={decision.id} className={`glass-panel ${index === 0 ? "border-violet-500/30" : "border-purple-500/30"}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={index === 0 ? "bg-violet-500/20 text-violet-400" : "bg-purple-500/20 text-purple-400"}>
                            Decision {index + 1}
                          </Badge>
                          <OutcomeBadge outcome={decision.outcome} />
                        </div>
                        <CardTitle className="font-mono text-lg">{decision.decision_id}</CardTitle>
                        <CardDescription>
                          {decision.request_type.replace(/_/g, " ")} • {format(decision.timestamp, "MMM d, yyyy HH:mm")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Applicant</span>
                          <span className="font-mono">{decision.applicant_id}</span>
                        </div>
                        {decision.amount && (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-mono">${decision.amount.toLocaleString()}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Comparison Table */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowLeftRight className="h-5 w-5 text-violet-400" />
                      Comparison Results
                    </CardTitle>
                    <CardDescription>Field-by-field analysis of differences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead className="text-center">Decision 1</TableHead>
                          <TableHead className="text-center w-16">Diff</TableHead>
                          <TableHead className="text-center">Decision 2</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonResults.map((result) => (
                          <TableRow key={result.field} className={result.difference !== "same" ? "bg-amber-500/5" : ""}>
                            <TableCell className="font-medium">{result.label}</TableCell>
                            <TableCell className="text-center font-mono">
                              {result.field === "outcome" ? (
                                <OutcomeBadge outcome={result.decision1 as string} />
                              ) : (
                                result.decision1
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <DifferenceIndicator difference={result.difference} />
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {result.field === "outcome" ? (
                                <OutcomeBadge outcome={result.decision2 as string} />
                              ) : (
                                result.decision2
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Rules Comparison */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-violet-400" />
                      Rules Triggered
                    </CardTitle>
                    <CardDescription>Policy rules that affected each decision</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedDecisionObjects.map((decision, index) => (
                        <div key={decision.id} className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            Decision {index + 1} ({decision.rules_triggered.length} rules)
                          </h4>
                          <div className="space-y-1">
                            {decision.rules_triggered.map((rule) => {
                              const otherDecision = selectedDecisionObjects[index === 0 ? 1 : 0];
                              const isUnique = !otherDecision.rules_triggered.includes(rule);
                              return (
                                <div
                                  key={rule}
                                  className={`px-2 py-1 rounded text-xs font-mono ${
                                    isUnique
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : "bg-secondary/30 text-muted-foreground"
                                  }`}
                                >
                                  {rule}
                                  {isUnique && <span className="ml-2 text-[10px]">(unique)</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Comparison
                  </Button>
                  <Link href={`/decisions/${selectedDecisionObjects[0].decision_id}`}>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      View Decision 1
                    </Button>
                  </Link>
                  <Link href={`/decisions/${selectedDecisionObjects[1].decision_id}`}>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      View Decision 2
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Card className="glass-panel h-full flex items-center justify-center min-h-[500px]">
                <CardContent className="text-center py-12">
                  <GitCompare className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Select Two Decisions</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Choose two decisions from the list on the left to see a detailed side-by-side comparison of their outcomes, risk scores, and policy evaluations.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
