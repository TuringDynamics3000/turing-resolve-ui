import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  FileJson,
  Copy,
  Shield,
  Activity,
  Link as LinkIcon,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface PolicyEvaluation {
  policyId: string;
  policyVersion: string;
  outcome: "ALLOW" | "REVIEW" | "DECLINE";
  explanation: string;
  ruleExpression: string;
  factsEvaluated: Record<string, any>;
  evaluationHash: string;
}

interface EvidencePack {
  evidencePack: {
    version: string;
    type: string;
    generatedAt: string;
  };
  decision: {
    decisionId: string;
    customerId: string;
    product: string;
    amount: string;
    currency: string;
    outcome: string;
    timestamp: string;
  };
  facts: Record<string, any>;
  policyEvaluations: PolicyEvaluation[];
  aggregatedDecision: {
    outcome: string;
    policiesEvaluated: number;
    policiesPassed: number;
    policiesFailed: number;
    policiesReview: number;
    summaryExplanation: string;
    decisionHash: string;
  };
  stateTransition: {
    fromState: string;
    toState: string;
    transitionAllowed: boolean;
    decisionIdRequired: boolean;
    decisionIdProvided: string;
  };
  hashChain: {
    factsHash: string;
    evaluationsHash: string;
    decisionHash: string;
    postingHash?: string;
    evidenceHash: string;
  };
  verification: {
    replaySafe: boolean;
    deterministic: boolean;
    allFactsPresent: boolean;
    allPoliciesEvaluated: boolean;
    hashChainValid: boolean;
  };
}

// Mock evidence pack data
const mockEvidencePack: EvidencePack = {
  evidencePack: {
    version: "1.0",
    type: "lending_decision",
    generatedAt: "2024-12-16T11:15:05Z",
  },
  decision: {
    decisionId: "DEC-LEND-2024-002",
    customerId: "CUST-AU-67890",
    product: "personal_loan",
    amount: "40000.00",
    currency: "AUD",
    outcome: "REVIEW",
    timestamp: "2024-12-16T11:15:00Z",
  },
  facts: {
    loan_application: {
      loan_id: "LOAN-2024-002",
      amount: "40000.00",
      term_months: 24,
      purpose: "home_improvement",
    },
    exposure_snapshot: {
      customer_id: "CUST-AU-67890",
      total_exposure: "125000.00",
      lending_exposure: "110000.00",
      payments_pending_exposure: "15000.00",
      holds_exposure: "0.00",
      currency: "AUD",
      as_of_ledger_event: 45890,
      snapshot_hash: "a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    },
  },
  policyEvaluations: [
    {
      policyId: "LIMIT-AU-TOTAL-001",
      policyVersion: "1.0",
      outcome: "REVIEW",
      explanation: "Projected total exposure $165,000.00 EXCEEDS cap of $150,000.00.",
      ruleExpression: "currency == 'AUD' and total_exposure <= 150000",
      factsEvaluated: {
        total_exposure: "165000.00",
        currency: "AUD",
        cap: "150000.00",
        breach_amount: "15000.00",
      },
      evaluationHash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
    },
    {
      policyId: "LIMIT-AU-LENDING-001",
      policyVersion: "1.0",
      outcome: "REVIEW",
      explanation: "Projected lending exposure $150,000.00 EXCEEDS cap of $120,000.00.",
      ruleExpression: "currency == 'AUD' and lending_exposure <= 120000",
      factsEvaluated: {
        lending_exposure: "150000.00",
        currency: "AUD",
        cap: "120000.00",
        breach_amount: "30000.00",
      },
      evaluationHash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
    },
    {
      policyId: "LIMIT-AU-STOPLIST-001",
      policyVersion: "1.0",
      outcome: "ALLOW",
      explanation: "Customer not on stoplist.",
      ruleExpression: "stoplist_flag == false",
      factsEvaluated: {
        stoplist_flag: false,
      },
      evaluationHash: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
    },
    {
      policyId: "LIMIT-AU-CONSISTENCY-001",
      policyVersion: "1.0",
      outcome: "ALLOW",
      explanation: "Exposure components consistent.",
      ruleExpression: "total_exposure >= (lending_exposure + payments_pending_exposure + holds_exposure)",
      factsEvaluated: {
        total_exposure: "165000.00",
        lending_exposure: "150000.00",
        payments_pending_exposure: "15000.00",
        holds_exposure: "0.00",
      },
      evaluationHash: "a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
    },
    {
      policyId: "LIMIT-AU-HIGHVALUE-001",
      policyVersion: "1.0",
      outcome: "ALLOW",
      explanation: "Exposure $165,000.00 below high-value threshold $250,000.00.",
      ruleExpression: "total_exposure < 250000",
      factsEvaluated: {
        total_exposure: "165000.00",
      },
      evaluationHash: "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7",
    },
  ],
  aggregatedDecision: {
    outcome: "REVIEW",
    policiesEvaluated: 5,
    policiesPassed: 3,
    policiesFailed: 0,
    policiesReview: 2,
    summaryExplanation: "2 of 5 policies require review. Exposure limits breached.",
    decisionHash: "b7e4f1a9c3d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7f0",
  },
  stateTransition: {
    fromState: "APPLICATION_RECEIVED",
    toState: "BLOCKED_BY_EXPOSURE",
    transitionAllowed: false,
    decisionIdRequired: true,
    decisionIdProvided: "DEC-LEND-2024-002",
  },
  hashChain: {
    factsHash: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    evaluationsHash: "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    decisionHash: "b7e4f1a9c3d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c1d4e7f0",
    evidenceHash: "f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
  },
  verification: {
    replaySafe: true,
    deterministic: true,
    allFactsPresent: true,
    allPoliciesEvaluated: true,
    hashChainValid: true,
  },
};

function getOutcomeBadge(outcome: string) {
  switch (outcome) {
    case "ALLOW":
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
          <CheckCircle2 className="h-3 w-3" />
          ALLOW
        </Badge>
      );
    case "REVIEW":
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500">
          <AlertTriangle className="h-3 w-3" />
          REVIEW
        </Badge>
      );
    case "DECLINE":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          DECLINE
        </Badge>
      );
    default:
      return <Badge variant="outline">{outcome}</Badge>;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface EvidenceViewerProps {
  decisionId?: string;
}

export function EvidenceViewer({ decisionId }: EvidenceViewerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const evidence = mockEvidencePack;

  const copyHash = (hash: string, label: string) => {
    navigator.clipboard.writeText(hash);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Evidence Pack
              </CardTitle>
              <CardDescription>
                Complete audit trail for decision {evidence.decision.decisionId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getOutcomeBadge(evidence.decision.outcome)}
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(evidence.decision.timestamp)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Decision ID</div>
              <div className="font-mono text-sm">{evidence.decision.decisionId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Customer</div>
              <div className="font-mono text-sm">{evidence.decision.customerId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Product</div>
              <div className="capitalize">{evidence.decision.product.replace("_", " ")}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="font-mono font-medium">${evidence.decision.amount} {evidence.decision.currency}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="facts">Facts</TabsTrigger>
          <TabsTrigger value="policies">Policy Evaluations</TabsTrigger>
          <TabsTrigger value="hashes">Hash Chain</TabsTrigger>
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Aggregated Decision */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Aggregated Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outcome</span>
                  {getOutcomeBadge(evidence.aggregatedDecision.outcome)}
                </div>
                <Separator />
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{evidence.aggregatedDecision.policiesEvaluated}</div>
                    <div className="text-xs text-muted-foreground">Evaluated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-500">{evidence.aggregatedDecision.policiesPassed}</div>
                    <div className="text-xs text-muted-foreground">Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-500">{evidence.aggregatedDecision.policiesReview}</div>
                    <div className="text-xs text-muted-foreground">Review</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-500">{evidence.aggregatedDecision.policiesFailed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Explanation</div>
                  <div className="text-sm">{evidence.aggregatedDecision.summaryExplanation}</div>
                </div>
              </CardContent>
            </Card>

            {/* State Transition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">State Transition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="text-center">
                    <Badge variant="outline" className="text-sm">
                      {evidence.stateTransition.fromState}
                    </Badge>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <Badge 
                      variant={evidence.stateTransition.transitionAllowed ? "outline" : "destructive"}
                      className="text-sm"
                    >
                      {evidence.stateTransition.toState}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transition Allowed</span>
                    {evidence.stateTransition.transitionAllowed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Decision ID Required</span>
                    {evidence.stateTransition.decisionIdRequired ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Status */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Verification Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {Object.entries(evidence.verification).map(([key, value]) => (
                    <div key={key} className="text-center p-3 bg-secondary/30 rounded-lg">
                      {value ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                      )}
                      <div className="text-xs text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Facts Tab */}
        <TabsContent value="facts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Input Facts</CardTitle>
              <CardDescription>
                Facts evaluated at decision time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {Object.entries(evidence.facts).map(([factType, factData]) => (
                  <AccordionItem key={factType} value={factType}>
                    <AccordionTrigger className="text-sm font-mono">
                      {factType}
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-secondary p-4 rounded-lg overflow-auto font-mono">
                        {JSON.stringify(factData, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Evaluations Tab */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy Evaluations</CardTitle>
              <CardDescription>
                Each policy evaluated against the input facts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evidence.policyEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.policyId}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {evaluation.policyId}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{evaluation.policyVersion}
                        </span>
                      </div>
                      {getOutcomeBadge(evaluation.outcome)}
                    </div>
                    <div className="text-sm">{evaluation.explanation}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Rule: </span>
                      <code className="bg-secondary px-1 rounded">{evaluation.ruleExpression}</code>
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="facts" className="border-0">
                        <AccordionTrigger className="text-xs py-2">
                          Facts Evaluated
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="text-xs bg-secondary p-2 rounded font-mono">
                            {JSON.stringify(evaluation.factsEvaluated, null, 2)}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      <code className="font-mono">{evaluation.evaluationHash.slice(0, 16)}...</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => copyHash(evaluation.evaluationHash, "Evaluation hash")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hash Chain Tab */}
        <TabsContent value="hashes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Hash Chain
              </CardTitle>
              <CardDescription>
                Cryptographic proof of evidence integrity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(evidence.hashChain).map(([key, hash], index) => (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium capitalize mb-1">
                        {key.replace(/([A-Z])/g, " $1").replace("Hash", " Hash")}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-secondary p-2 rounded font-mono flex-1 break-all">
                          {hash}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyHash(hash, key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw JSON Tab */}
        <TabsContent value="json" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileJson className="h-5 w-5" />
                    Raw Evidence Pack
                  </CardTitle>
                  <CardDescription>
                    Complete JSON representation
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(evidence, null, 2));
                    toast.success("JSON copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-secondary p-4 rounded-lg overflow-auto max-h-[600px] font-mono">
                {JSON.stringify(evidence, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EvidenceViewer;
