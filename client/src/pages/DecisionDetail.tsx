import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { mockDecisions } from "@/lib/mockData";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Shield,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function DecisionDetail() {
  const [, params] = useRoute("/decisions/:id");
  const decisionId = params?.id;
  const decision = mockDecisions.find((d) => d.decision_id === decisionId);

  if (!decision) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Decision Not Found</h2>
        <Link href="/decisions">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Navigation */}
      <div className="flex items-center gap-4">
        <Link href="/decisions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {decision.decision_id}
            </h1>
            <Badge variant="outline" className="font-mono">
              {decision.policy_version}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            Entity: <span className="font-mono text-foreground">{decision.entity_id}</span>
            <span className="text-muted-foreground/50">•</span>
            {formatDistanceToNow(new Date(decision.timestamp))} ago
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast.success("Evidence package downloaded", { description: `SHA-256: ${decision.decision_id}-proof.pdf` })}>
            <Download className="mr-2 h-4 w-4" />
            Export Proof
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button variant="outline" className="border-red-200 hover:bg-red-50 text-red-600">
            Reject
          </Button>
          <Button variant="outline" className="border-yellow-200 hover:bg-yellow-50 text-yellow-600">
            Escalate
          </Button>
          <Button className="bg-green-600 hover:bg-green-700">
            Approve
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Column: Explanation Tree (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Decision Outcome
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {decision.outcome === 'APPROVED' && <CheckCircle className="h-8 w-8 text-green-500 mt-1" />}
                {decision.outcome === 'REJECTED' && <XCircle className="h-8 w-8 text-red-500 mt-1" />}
                {decision.outcome === 'FLAGGED_FOR_REVIEW' && <AlertTriangle className="h-8 w-8 text-yellow-500 mt-1" />}
                
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{decision.outcome.replace(/_/g, ' ')}</h3>
                  <p className="text-muted-foreground">{decision.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Explanation Trace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {decision.explanation_tree.map((node, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2 font-medium">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    {node.title}
                  </div>
                  <div className="pl-6 space-y-2 border-l-2 border-muted ml-2">
                    {node.children.map((child, cIdx) => (
                      <div key={cIdx} className="p-3 bg-muted/30 rounded-md border text-sm">
                        <div className="font-medium mb-1">{child.title}</div>
                        <div className="text-muted-foreground mb-2">{child.content}</div>
                        {Object.keys(child.evidence).length > 0 && (
                          <div className="bg-background p-2 rounded border font-mono text-xs">
                            {JSON.stringify(child.evidence, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Context & Metadata (1/3 width) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-4">
                <div className="relative flex items-center justify-center h-24 w-24 rounded-full border-8 border-muted">
                  <span className="text-3xl font-bold">{decision.risk_score}</span>
                  <div 
                    className="absolute inset-0 rounded-full border-8 border-transparent border-t-primary rotate-45"
                    style={{ 
                      borderColor: decision.risk_score > 80 ? 'rgb(239 68 68)' : 
                                  decision.risk_score > 50 ? 'rgb(234 179 8)' : 'rgb(34 197 94)',
                      transform: `rotate(${(decision.risk_score / 100) * 360}deg)`
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Key Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(decision.facts).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm border-b pb-2 last:border-0">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-medium text-right">{String(value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-muted ml-2 space-y-6 py-2">
                {decision.timeline.map((event, idx) => (
                  <div key={idx} className="ml-4 relative">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">
                      {formatDistanceToNow(new Date(event.timestamp))} ago
                    </div>
                    <div className="text-sm font-medium">{event.type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted-foreground">{event.description}</div>
                  </div>
                ))}
                {decision.timeline.length === 0 && (
                  <div className="ml-4 text-sm text-muted-foreground italic">
                    No timeline events recorded.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
