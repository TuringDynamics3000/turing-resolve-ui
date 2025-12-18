import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  User, 
  Clock,
  Shield,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const DOMAIN_COLORS: Record<string, string> = {
  DEPOSITS: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  PAYMENTS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LENDING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ML: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POLICY: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  OPS: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const REASON_LABELS: Record<string, string> = {
  AUTHORIZED: "Authorized",
  ROLE_MISSING: "Role Missing",
  APPROVAL_REQUIRED: "Needs Approval",
  FORBIDDEN_COMMAND: "Forbidden",
  SCOPE_MISMATCH: "Scope Mismatch",
  EXPIRED_ASSIGNMENT: "Expired",
  COMMAND_NOT_FOUND: "Unknown Command",
};

interface DecisionFact {
  authorityFactId: string;
  actorId: string;
  actorRole: string;
  commandCode: string;
  resourceId?: string;
  decision: "ALLOW" | "DENY";
  reasonCode: string;
  domain?: string;
  createdAt: string;
}

function DecisionItem({ fact }: { fact: DecisionFact }) {
  const isAllowed = fact.decision === "ALLOW";
  const domainColor = DOMAIN_COLORS[fact.domain || "OPS"] || DOMAIN_COLORS.OPS;
  
  // Format actor email to show just the name part
  const actorName = fact.actorId.split("@")[0];
  
  // Format command for display
  const commandDisplay = fact.commandCode.replace(/_/g, " ").toLowerCase();
  
  // Parse timestamp
  const timestamp = new Date(fact.createdAt);
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });
  
  return (
    <div className={`p-3 rounded-lg border transition-all ${
      isAllowed 
        ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40" 
        : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg ${isAllowed ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
            {isAllowed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium capitalize ${isAllowed ? "text-emerald-400" : "text-red-400"}`}>
                {commandDisplay}
              </span>
              <Badge variant="outline" className={`text-xs ${domainColor}`}>
                {fact.domain || "OPS"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
              <User className="h-3 w-3" />
              <span className="truncate">{actorName}</span>
              <span className="text-zinc-600">•</span>
              <Shield className="h-3 w-3" />
              <span>{fact.actorRole.replace(/_/g, " ")}</span>
            </div>
            {!isAllowed && (
              <div className="flex items-center gap-1 mt-1.5">
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                  {REASON_LABELS[fact.reasonCode] || fact.reasonCode}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-600 whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
          <div className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-lg bg-zinc-800" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 bg-zinc-800 mb-2" />
              <Skeleton className="h-3 w-48 bg-zinc-800" />
            </div>
            <Skeleton className="h-3 w-16 bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LiveDecisionFeedProps {
  domain?: string;
}

export function LiveDecisionFeed({ domain }: LiveDecisionFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  
  const { data: facts, isLoading } = trpc.rbac.getRecentAuthorityFacts.useQuery(
    { limit: 20, domain },
    { refetchInterval: 10000 } // Refresh every 10 seconds
  );

  // Auto-scroll to top when new data arrives
  useEffect(() => {
    if (feedRef.current && facts && facts.length > 0) {
      feedRef.current.scrollTop = 0;
    }
  }, [facts]);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-zinc-100">Live Decision Feed</CardTitle>
              <CardDescription className="text-zinc-500">Recent authority decisions in real-time</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-zinc-500">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={feedRef}
          className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
        >
          {isLoading ? (
            <FeedSkeleton />
          ) : facts && facts.length > 0 ? (
            facts.map((fact) => (
              <DecisionItem key={fact.authorityFactId} fact={fact as DecisionFact} />
            ))
          ) : (
            <div className="text-center py-8">
              <Zap className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No recent decisions</p>
              <p className="text-zinc-600 text-xs mt-1">Decisions will appear here in real-time</p>
            </div>
          )}
        </div>
        
        {facts && facts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>{facts.filter(f => f.decision === "ALLOW").length} allowed</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-400" />
                <span>{facts.filter(f => f.decision === "DENY").length} denied</span>
              </div>
            </div>
            <span className="text-xs text-zinc-600">Last 20 decisions</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
