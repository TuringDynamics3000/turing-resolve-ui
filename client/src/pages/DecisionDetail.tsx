import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskIndicator } from "@/components/ui/risk-indicator";
import { ExplanationTree, ExplanationTreeSkeleton } from "@/components/ui/explanation-tree";
import { EvidencePanel, EvidencePanelSkeleton, EvidenceItem } from "@/components/ui/evidence-panel";
import { Timeline, TimelineSkeleton, TimelineEvent } from "@/components/ui/timeline";
import { fetchDecisionDetail, fetchDecisionEvidence } from "@/lib/api";
import { Decision } from "@/lib/mockData";
import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileText,
  Shield,
  ShieldCheck,
  XCircle,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";

// Loading skeleton
function DecisionDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-muted rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ExplanationTreeSkeleton />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-muted/30 rounded-lg" />
          <TimelineSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}

export default function DecisionDetail() {
  const [, params] = useRoute("/decisions/:id");
  const decisionId = params?.id;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [evidence, setEvidence] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("explanation");

  useEffect(() => {
    if (decisionId) {
      setLoading(true);
      Promise.all([
        fetchDecisionDetail(decisionId).then(setDecision),
        fetchDecisionEvidence(decisionId).then(setEvidence).catch((e: unknown) => console.warn("Evidence fetch failed", e))
      ])
      .catch(console.error)
      .finally(() => setLoading(false));
    }
  }, [decisionId]);

  const handleExportProof = () => {
    toast.success("Evidence package downloaded", { 
      description: `SHA-256: ${decision?.decision_id}-proof.pdf` 
    });
  };

  const handleCopyId = () => {
    if (decision) {
      navigator.clipboard.writeText(decision.decision_id);
      toast.success("Decision ID copied to clipboard");
    }
  };

  const getOutcomeConfig = (outcome: string) => {
    switch (outcome) {
      case "APPROVED":
        return {
          variant: "success" as const,
          icon: <CheckCircle2 className="w-6 h-6" />,
          label: "Approved",
          bgClass: "bg-success/10 border-success/30"
        };
      case "REJECTED":
        return {
          variant: "destructive" as const,
          icon: <XCircle className="w-6 h-6" />,
          label: "Rejected",
          bgClass: "bg-destructive/10 border-destructive/30"
        };
      case "FLAGGED_FOR_REVIEW":
        return {
          variant: "warning" as const,
          icon: <AlertTriangle className="w-6 h-6" />,
          label: "Flagged for Review",
          bgClass: "bg-warning/10 border-warning/30"
        };
      default:
        return {
          variant: "muted" as const,
          icon: <Clock className="w-6 h-6" />,
          label: outcome,
          bgClass: "bg-muted/10 border-muted/30"
        };
    }
  };

  if (loading) {
    return <DecisionDetailSkeleton />;
  }

  if (!decision) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Decision Not Found</h2>
        <p className="text-muted-foreground">The requested decision could not be located.</p>
        <Link href="/decisions">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>
        </Link>
      </div>
    );
  }

  const outcomeConfig = getOutcomeConfig(decision.outcome);

  // Transform timeline events for the Timeline component
  const timelineEvents: TimelineEvent[] = decision.timeline.map((event, idx) => ({
    id: event.id || `evt-${idx}`,
    title: event.type.replace(/_/g, " "),
    description: event.description,
    timestamp: formatDistanceToNow(new Date(event.timestamp)) + " ago",
    status: idx === decision.timeline.length - 1 ? "current" : "complete",
    metadata: event.details ? { 
      ...Object.fromEntries(
        Object.entries(event.details).slice(0, 2).map(([k, v]) => [k, String(v)])
      )
    } : undefined
  }));

  // Transform evidence for the EvidencePanel component
  const evidenceItems: EvidenceItem[] = evidence ? [
    {
      id: "facts",
      type: "fact",
      label: "Application Facts",
      value: `${Object.keys(decision.facts).length} facts collected`,
      hash: evidence.manifest?.facts_hash
    },
    {
      id: "policy",
      type: "policy",
      label: "Policy Decision",
      value: `Policy ${decision.policy_version}`,
      hash: evidence.manifest?.decision_hash
    },
    {
      id: "history",
      type: "ledger",
      label: "Event History",
      value: `${decision.timeline.length} events recorded`,
      hash: evidence.manifest?.history_hash
    }
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/decisions">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 
                className="text-xl lg:text-2xl font-bold tracking-tight font-mono cursor-pointer hover:text-primary transition-colors"
                onClick={handleCopyId}
                title="Click to copy"
              >
                {decision.decision_id}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {decision.policy_version}
              </Badge>
              <StatusBadge variant={outcomeConfig.variant}>
                {outcomeConfig.label}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
              <span className="font-mono">{decision.entity_id}</span>
              <span className="text-muted-foreground/50">•</span>
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(decision.timestamp))} ago
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportProof}>
            <Download className="mr-2 h-4 w-4" />
            Export Proof
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="border-destructive/30 hover:bg-destructive/10 text-destructive"
              onClick={() => toast.info("Reject action", { description: "This would reject the decision" })}
            >
              Reject
            </Button>
            <Button 
              variant="outline" 
              className="border-warning/30 hover:bg-warning/10 text-warning"
              onClick={() => toast.info("Escalate action", { description: "This would escalate to senior review" })}
            >
              Escalate
            </Button>
            <Button 
              className="bg-success hover:bg-success/90"
              onClick={() => toast.success("Decision approved", { description: "The decision has been approved" })}
            >
              Approve
            </Button>
          </div>
        </div>
      </div>

      {/* Outcome Banner */}
      <div className={cn(
        "rounded-lg border p-4 flex items-center gap-4",
        outcomeConfig.bgClass
      )}>
        <div className={cn(
          "shrink-0",
          outcomeConfig.variant === "success" && "text-success",
          outcomeConfig.variant === "destructive" && "text-destructive",
          outcomeConfig.variant === "warning" && "text-warning"
        )}>
          {outcomeConfig.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{outcomeConfig.label}</h3>
          <p className="text-sm text-muted-foreground">{decision.summary}</p>
        </div>
        <RiskIndicator value={decision.risk_score} size="lg" showLabel />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Explanation & Evidence (2/3 width) */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="explanation" className="gap-2">
                <Zap className="w-4 h-4" />
                Explanation
              </TabsTrigger>
              <TabsTrigger value="evidence" className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                Evidence Pack
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="explanation" className="space-y-4 mt-0">
              <ExplanationTree
                nodes={decision.explanation_tree.flatMap(node => [
                  {
                    id: node.title,
                    label: node.title,
                    status: "info" as const,
                    description: node.content,
                    children: node.children.map((child, idx) => ({
                      id: `${node.title}-${idx}`,
                      label: child.title,
                      status: child.title.includes("PASSED") ? "pass" as const : 
                              child.title.includes("FAILED") ? "fail" as const : 
                              child.title.includes("WARNING") ? "warn" as const : "info" as const,
                      description: child.content,
                      value: Object.keys(child.evidence).length > 0 ? JSON.stringify(child.evidence) : undefined,
                      children: []
                    }))
                  }
                ])}
              />
            </TabsContent>

            <TabsContent value="evidence" className="mt-0">
              {evidence ? (
                <EvidencePanel
                  title="Regulator Evidence Pack"
                  items={evidenceItems}
                  replayHash={evidence.replay_hash}
                  manifestHash={evidence.manifest?.schema_version}
                />
              ) : (
                <EvidencePanelSkeleton />
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Context & Timeline (1/3 width) */}
        <div className="space-y-6">
          {/* Key Facts */}
          <div className="glass-panel p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Key Facts
            </h3>
            <div className="space-y-2">
              {Object.entries(decision.facts).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-mono font-medium text-right">
                    {typeof value === "number" && key.includes("amount") 
                      ? `$${value.toLocaleString()}`
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-panel p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Decision Timeline
            </h3>
            {timelineEvents.length > 0 ? (
              <Timeline events={timelineEvents} />
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No timeline events recorded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4">
        <span className="flex items-center gap-1">
          <kbd className="kbd">Esc</kbd>
          Back
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">E</kbd>
          Export
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">A</kbd>
          Approve
        </span>
      </div>
    </div>
  );
}
