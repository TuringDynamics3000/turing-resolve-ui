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
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskIndicator } from "@/components/ui/risk-indicator";
import { DecisionCard, DecisionCardSkeleton } from "@/components/ui/decision-card";
import { fetchDecisions } from "@/lib/api";
import { Decision } from "@/lib/mockData";
import { formatDistanceToNow } from "date-fns";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  RefreshCw,
  AlertTriangle,
  Filter,
  LayoutGrid,
  LayoutList,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "table";
type FilterType = "ALL" | "CRITICAL" | "HIGH" | "REVIEW";

// Stats card component
function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconColor,
  trend,
  trendValue 
}: { 
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: "up" | "down";
  trendValue?: string;
}) {
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {trend && trendValue && (
          <div className={cn(
            "flex items-center gap-1 text-xs",
            trend === "up" ? "text-success" : "text-destructive"
          )}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpsInbox() {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDecisions = async () => {
    try {
      const data = await fetchDecisions();
      setDecisions(data);
    } catch (error) {
      console.error("Failed to fetch decisions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDecisions();
  };

  // Filter decisions based on search and filter
  const filteredDecisions = decisions.filter((d) => {
    const matchesSearch = 
      d.decision_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.entity_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "ALL") return matchesSearch;
    if (filter === "CRITICAL") return matchesSearch && d.outcome === "REJECTED";
    if (filter === "REVIEW") return matchesSearch && d.outcome === "FLAGGED_FOR_REVIEW";
    return matchesSearch;
  });

  const getOutcomeVariant = (outcome: string) => {
    switch (outcome) {
      case "APPROVED": return "success";
      case "REJECTED": return "destructive";
      case "FLAGGED": return "warning";
      default: return "muted";
    }
  };

  const mapOutcome = (outcome: string): "approve" | "decline" | "flag" | "review" | "pass" => {
    switch (outcome) {
      case "APPROVED": return "approve";
      case "REJECTED": return "decline";
      case "FLAGGED_FOR_REVIEW": return "flag";
      default: return "review";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ops Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Triage and resolve flagged decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search decisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] bg-card/50"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Critical"
          value={3}
          subtitle="+1 since last hour"
          icon={AlertCircle}
          iconColor="text-destructive"
          trend="up"
          trendValue="+1"
        />
        <StatsCard
          title="High Priority"
          value={12}
          subtitle="4 SLA breaches imminent"
          icon={Clock}
          iconColor="text-warning"
        />
        <StatsCard
          title="Awaiting Review"
          value={24}
          subtitle="Average wait: 45m"
          icon={Clock}
          iconColor="text-info"
        />
        <StatsCard
          title="Resolved Today"
          value={156}
          subtitle="+12% from yesterday"
          icon={CheckCircle2}
          iconColor="text-success"
          trend="up"
          trendValue="+12%"
        />
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
            {(["ALL", "CRITICAL", "HIGH", "REVIEW"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Table view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Decision Queue */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <DecisionCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="glass-panel p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDecisions.map((decision) => (
            <DecisionCard
              key={decision.decision_id}
              decisionId={decision.decision_id}
              entityId={decision.entity_id}
              outcome={mapOutcome(decision.outcome)}
              riskScore={decision.risk_score}
              timestamp={formatDistanceToNow(new Date(decision.timestamp)) + " ago"}
              summary={decision.summary}
              href={`/decisions/${decision.decision_id}`}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="font-semibold">Decision Queue</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[180px]">Decision ID</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Time in Queue</TableHead>
                  <TableHead className="max-w-[200px]">Summary</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDecisions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="w-8 h-8" />
                        <p>No decisions found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDecisions.map((decision) => (
                    <TableRow 
                      key={decision.decision_id}
                      className="group cursor-pointer"
                    >
                      <TableCell className="font-mono text-sm">
                        {decision.decision_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {decision.entity_id}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={getOutcomeVariant(decision.outcome) as any}>
                          {decision.outcome.toLowerCase()}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {decision.risk_score !== undefined && (
                          <div className="w-20">
                            <RiskIndicator value={decision.risk_score} size="sm" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(decision.timestamp))} ago
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="truncate block text-sm text-muted-foreground" title={decision.summary}>
                          {decision.summary}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/decisions/${decision.decision_id}`}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Review
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="kbd">↑</kbd>
          <kbd className="kbd">↓</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">Enter</kbd>
          Open
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">R</kbd>
          Refresh
        </span>
      </div>
    </div>
  );
}
