import { useState, useEffect } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  Database,
  Zap,
  Shield,
  FileText,
  ArrowRight,
  TrendingUp,
  XCircle,
  Gauge,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ============================================
// COMPONENTS
// ============================================

function HealthStatusBadge({ status }: { status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UP' | 'DOWN' }) {
  const colors = {
    HEALTHY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    UP: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    DEGRADED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    CRITICAL: "bg-red-500/10 text-red-400 border-red-500/30",
    DOWN: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  
  const icons = {
    HEALTHY: CheckCircle,
    UP: CheckCircle,
    DEGRADED: AlertTriangle,
    CRITICAL: XCircle,
    DOWN: XCircle,
  };
  
  const Icon = icons[status];
  
  return (
    <Badge className={colors[status]}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
}

function StatCard({ 
  label, 
  value, 
  subValue,
  icon: Icon, 
  color,
  trend,
  loading = false
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ElementType; 
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}) {
  return (
    <Card className={`bg-slate-900/50 border-slate-800 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-slate-700" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-100">{value}</p>
                {subValue && <p className="text-xs text-slate-500">{subValue}</p>}
              </>
            )}
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/50">
            <Icon className="w-6 h-6 opacity-70" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComponentHealthCard({ 
  component 
}: { 
  component: {
    name: string;
    status: 'UP' | 'DOWN' | 'DEGRADED';
    latency?: number;
    lastCheck: Date;
    message?: string;
  };
}) {
  const statusColors = {
    UP: "border-emerald-500/30",
    DEGRADED: "border-amber-500/30",
    DOWN: "border-red-500/30",
  };
  
  const icons: Record<string, React.ElementType> = {
    'Decision Engine': Zap,
    'Ledger Service': FileText,
    'Policy Engine': Shield,
    'Evidence Store': Database,
    'Merkle Sealer': Shield,
    'NPP Gateway': ArrowRight,
    'BECS Gateway': ArrowRight,
    'Database': Database,
  };
  
  const Icon = icons[component.name] || Server;
  
  return (
    <Card className={`bg-slate-900/50 border-slate-800 ${statusColors[component.status]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            component.status === 'UP' ? 'bg-emerald-500/10' :
            component.status === 'DEGRADED' ? 'bg-amber-500/10' : 'bg-red-500/10'
          }`}>
            <Icon className={`w-5 h-5 ${
              component.status === 'UP' ? 'text-emerald-400' :
              component.status === 'DEGRADED' ? 'text-amber-400' : 'text-red-400'
            }`} />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-100">{component.name}</span>
              <HealthStatusBadge status={component.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
              {component.latency !== undefined && (
                <span>{component.latency}ms latency</span>
              )}
              <span>Checked {formatDistanceToNow(new Date(component.lastCheck), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SLABreachCard({ 
  breach 
}: { 
  breach: {
    decisionId: string;
    type: string;
    breachedAt: Date;
    slaMinutes: number;
    actualMinutes: number;
  };
}) {
  const overageMinutes = breach.actualMinutes - breach.slaMinutes;
  const overagePercent = ((breach.actualMinutes / breach.slaMinutes) * 100 - 100).toFixed(0);
  
  return (
    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <div>
            <span className="font-mono text-sm text-slate-300">{breach.decisionId}</span>
            <span className="text-xs text-slate-500 ml-2">{breach.type}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-red-400 font-medium">+{overageMinutes}min</span>
          <span className="text-xs text-slate-500 ml-2">({overagePercent}% over SLA)</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function SystemHealthPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Fetch system health
  const { data: health, isLoading, refetch } = trpc.ops.getSystemHealth.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds if auto-refresh is on
  });
  
  // Fetch decision stats for additional context
  const { data: stats } = trpc.ops.getDecisionStats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10000 : false,
  });
  
  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };
  
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastRefresh(new Date());
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);
  
  const overallStatus = health?.overall || 'HEALTHY';
  const backlog = health?.decisionBacklog;
  const slaBreaches = health?.slaBreaches;
  const retryQueue = health?.retryQueue;
  const components = health?.components || [];
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">System Health</h1>
              <HealthStatusBadge status={overallStatus} />
            </div>
            <p className="text-slate-400 mt-1">
              Real-time monitoring of decision processing and system components
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`border-slate-700 ${autoRefresh ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button 
              variant="outline" 
              className="border-slate-700 text-slate-300"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Last Updated */}
        <div className="text-xs text-slate-500 mb-4">
          Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Decision Backlog"
            value={backlog?.total ?? 0}
            subValue={`${backlog?.pending ?? 0} pending, ${backlog?.inProgress ?? 0} in progress`}
            icon={Clock}
            color={backlog && backlog.total > 20 ? "border-l-4 border-l-amber-500" : ""}
            loading={isLoading}
          />
          <StatCard
            label="Oldest Item"
            value={backlog ? `${backlog.oldestItemAge}min` : '0min'}
            subValue={backlog && backlog.oldestItemAge > 60 ? "Exceeds target" : "Within target"}
            icon={Timer}
            color={backlog && backlog.oldestItemAge > 60 ? "border-l-4 border-l-red-500" : ""}
            loading={isLoading}
          />
          <StatCard
            label="SLA Breaches"
            value={slaBreaches?.total ?? 0}
            subValue={slaBreaches ? `${slaBreaches.critical} critical, ${slaBreaches.high} high` : ''}
            icon={AlertTriangle}
            color={slaBreaches && slaBreaches.total > 0 ? "border-l-4 border-l-red-500" : ""}
            loading={isLoading}
          />
          <StatCard
            label="Retry Queue"
            value={retryQueue?.total ?? 0}
            subValue={retryQueue ? `${(retryQueue.failureRate * 100).toFixed(1)}% failure rate` : ''}
            icon={RefreshCw}
            color={retryQueue && retryQueue.total > 5 ? "border-l-4 border-l-amber-500" : ""}
            loading={isLoading}
          />
        </div>
        
        {/* Decision Processing Stats */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-slate-100">Decision Processing</CardTitle>
            <CardDescription className="text-slate-400">
              Average processing time: {backlog?.avgProcessingTime ?? 0} minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-red-400">{stats?.byPriority?.critical ?? 0}</p>
                <p className="text-xs text-slate-500">Critical</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-orange-400">{stats?.byPriority?.high ?? 0}</p>
                <p className="text-xs text-slate-500">High</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-400">{stats?.byPriority?.medium ?? 0}</p>
                <p className="text-xs text-slate-500">Medium</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-slate-400">{stats?.byPriority?.low ?? 0}</p>
                <p className="text-xs text-slate-500">Low</p>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-emerald-500/30">
                <p className="text-2xl font-bold text-emerald-400">{stats?.completedToday ?? 0}</p>
                <p className="text-xs text-slate-500">Completed Today</p>
              </div>
            </div>
            
            {/* By Type */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400 mb-3">By Decision Type</p>
              <div className="flex gap-4">
                {stats?.byType && Object.entries(stats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="border-slate-700 text-slate-300">
                    {type.replace(/([A-Z])/g, ' $1').trim()}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* SLA Breaches */}
        {slaBreaches && slaBreaches.total > 0 && (
          <Card className="bg-slate-900/50 border-red-500/30 mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <CardTitle className="text-lg text-red-400">SLA Breaches</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                {slaBreaches.total} decisions have exceeded their SLA deadline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {slaBreaches.recentBreaches.map((breach, i) => (
                <SLABreachCard key={i} breach={breach} />
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Retry Queue */}
        {retryQueue && retryQueue.total > 0 && (
          <Card className="bg-slate-900/50 border-amber-500/30 mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <CardTitle className="text-lg text-amber-400">Retry Queue</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                {retryQueue.total} items pending retry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(retryQueue.byType).map(([type, count]) => (
                  <div key={type} className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-lg font-bold text-slate-100">{count}</p>
                    <p className="text-xs text-slate-500">{type}</p>
                  </div>
                ))}
              </div>
              {retryQueue.oldestRetry && (
                <p className="text-xs text-slate-500 mt-3">
                  Oldest retry: {formatDistanceToNow(new Date(retryQueue.oldestRetry), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Component Health */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-100">Component Health</CardTitle>
            <CardDescription className="text-slate-400">
              Status of all system components
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-20 bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {components.map((component, i) => (
                  <ComponentHealthCard key={i} component={component} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OpsConsoleLayout>
  );
}
