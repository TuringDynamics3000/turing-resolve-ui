import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Activity,
  Zap,
  Clock,
  RefreshCw,
  Shield,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Link } from "wouter";

// Types matching backend
type HealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface ModelHealthData {
  model_id: string;
  domain_type: string;
  health: HealthStatus;
  latency_p95_ms: number;
  error_rate: number;
  timeout_rate: number;
  total_inferences: number;
  auto_disable_triggered: boolean;
  auto_disable_reason?: string;
}

interface ServiceMetrics {
  circuit_state: CircuitState;
  avg_latency_ms: number;
  total_requests: number;
  failed_requests: number;
  circuit_breaker_trips: number;
}

// Mock data (will be replaced with tRPC queries)
const mockModelHealth: ModelHealthData[] = [
  {
    model_id: "credit-risk-v1",
    domain_type: "CREDIT_SCORING",
    health: "HEALTHY",
    latency_p95_ms: 120,
    error_rate: 0.001,
    timeout_rate: 0.0002,
    total_inferences: 125000,
    auto_disable_triggered: false,
  },
  {
    model_id: "fraud-detection-v2",
    domain_type: "FRAUD_DETECTION",
    health: "HEALTHY",
    latency_p95_ms: 65,
    error_rate: 0.0005,
    timeout_rate: 0.0001,
    total_inferences: 450000,
    auto_disable_triggered: false,
  },
  {
    model_id: "exposure-limit-v1",
    domain_type: "EXPOSURE_SCORING",
    health: "DEGRADED",
    latency_p95_ms: 350,
    error_rate: 0.02,
    timeout_rate: 0.005,
    total_inferences: 75000,
    auto_disable_triggered: true,
    auto_disable_reason: "Error rate exceeded 1% threshold",
  },
];

const mockServiceMetrics: ServiceMetrics = {
  circuit_state: "CLOSED",
  avg_latency_ms: 85,
  total_requests: 650000,
  failed_requests: 1250,
  circuit_breaker_trips: 2,
};

function HealthStatusIcon({ status }: { status: HealthStatus }) {
  switch (status) {
    case "HEALTHY":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "DEGRADED":
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case "UNHEALTHY":
      return <XCircle className="h-4 w-4 text-red-400" />;
    default:
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
  }
}

function CircuitStateBadge({ state }: { state: CircuitState }) {
  const config: Record<CircuitState, { color: string; label: string }> = {
    CLOSED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Closed" },
    OPEN: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Open" },
    HALF_OPEN: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Half-Open" },
  };

  const { color, label } = config[state];

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Shield className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

interface ModelHealthWidgetProps {
  compact?: boolean;
}

export function ModelHealthWidget({ compact = false }: ModelHealthWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const healthyCount = mockModelHealth.filter(m => m.health === "HEALTHY").length;
  const degradedCount = mockModelHealth.filter(m => m.health === "DEGRADED" || m.health === "UNHEALTHY").length;
  const totalInferences = mockModelHealth.reduce((sum, m) => sum + m.total_inferences, 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (compact) {
    // Compact version for stat cards
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            ML Models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {healthyCount}/{mockModelHealth.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {degradedCount > 0 ? (
                  <span className="text-yellow-400">{degradedCount} degraded</span>
                ) : (
                  "All healthy"
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <CircuitStateBadge state={mockServiceMetrics.circuit_state} />
              <span className="text-xs text-muted-foreground">
                {formatNumber(totalInferences)} inferences
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              ML Model Health
            </CardTitle>
            <CardDescription>Auto-disable triggers and service metrics</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/ml-models">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Model Service</p>
              <p className="text-xs text-muted-foreground">
                Avg latency: {mockServiceMetrics.avg_latency_ms.toFixed(0)}ms
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CircuitStateBadge state={mockServiceMetrics.circuit_state} />
            {mockServiceMetrics.circuit_breaker_trips > 0 && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                    {mockServiceMetrics.circuit_breaker_trips} trips
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Circuit breaker has tripped {mockServiceMetrics.circuit_breaker_trips} times</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Model List */}
        <div className="space-y-3">
          {mockModelHealth.map((model) => (
            <div 
              key={model.model_id}
              className={`p-3 rounded-lg border transition-colors ${
                model.auto_disable_triggered 
                  ? 'border-red-500/30 bg-red-500/5' 
                  : 'border-border bg-secondary/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HealthStatusIcon status={model.health} />
                  <span className="font-mono text-sm">{model.model_id}</span>
                </div>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {model.domain_type}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Latency p95
                  </span>
                  <span className={`font-mono ${model.latency_p95_ms > 300 ? 'text-yellow-400' : ''}`}>
                    {model.latency_p95_ms}ms
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Error Rate
                  </span>
                  <span className={`font-mono ${model.error_rate > 0.01 ? 'text-red-400' : ''}`}>
                    {(model.error_rate * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Inferences
                  </span>
                  <span className="font-mono">{formatNumber(model.total_inferences)}</span>
                </div>
              </div>

              {model.auto_disable_triggered && (
                <div className="mt-2 pt-2 border-t border-red-500/20">
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Auto-disable triggered: {model.auto_disable_reason}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Auto-Disable Thresholds */}
        <div className="pt-3 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Auto-Disable Thresholds</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span>p95 &gt; 500ms</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              <span>Error &gt; 1%</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>Timeout &gt; 0.5%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ModelHealthWidget;
