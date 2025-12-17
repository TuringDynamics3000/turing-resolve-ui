import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Eye,
  XCircle,
  RefreshCw,
  Lock,
  Activity,
  Zap,
  Shield,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// Model lifecycle states from ModelGovernanceV2
type ModelStatus = 
  | "REGISTERED"
  | "SHADOW"
  | "CANARY"
  | "PRODUCTION"
  | "DEPRECATED"
  | "REVOKED";

// Mock model data (will be replaced with tRPC queries)
const mockModels = [
  {
    model_id: "credit-risk-v1",
    domain_type: "CREDIT_SCORING",
    description: "Credit risk assessment model for lending decisions",
    versions: [
      {
        model_version_id: "credit-risk-v1:1.0.0",
        version_label: "1.0.0",
        status: "PRODUCTION" as ModelStatus,
        artifact_hash: "a1b2c3d4e5f6...",
        manifest_hash: "f6e5d4c3b2a1...",
        created_at: "2024-11-01T10:00:00Z",
        promoted_at: "2024-11-15T14:30:00Z",
      },
      {
        model_version_id: "credit-risk-v1:1.1.0",
        version_label: "1.1.0",
        status: "CANARY" as ModelStatus,
        artifact_hash: "b2c3d4e5f6a1...",
        manifest_hash: "e5d4c3b2a1f6...",
        created_at: "2024-12-01T09:00:00Z",
        promoted_at: "2024-12-10T11:00:00Z",
      },
      {
        model_version_id: "credit-risk-v1:1.2.0",
        version_label: "1.2.0",
        status: "SHADOW" as ModelStatus,
        artifact_hash: "c3d4e5f6a1b2...",
        manifest_hash: "d4c3b2a1f6e5...",
        created_at: "2024-12-15T08:00:00Z",
        promoted_at: null,
      },
    ],
    health: {
      status: "HEALTHY",
      latency_p50_ms: 45,
      latency_p95_ms: 120,
      latency_p99_ms: 250,
      error_rate: 0.001,
      timeout_rate: 0.0002,
      total_inferences: 125000,
    },
  },
  {
    model_id: "fraud-detection-v2",
    domain_type: "FRAUD_DETECTION",
    description: "Real-time fraud detection for payment transactions",
    versions: [
      {
        model_version_id: "fraud-detection-v2:2.0.0",
        version_label: "2.0.0",
        status: "PRODUCTION" as ModelStatus,
        artifact_hash: "d4e5f6a1b2c3...",
        manifest_hash: "c3b2a1f6e5d4...",
        created_at: "2024-10-15T12:00:00Z",
        promoted_at: "2024-10-30T16:00:00Z",
      },
      {
        model_version_id: "fraud-detection-v2:2.1.0",
        version_label: "2.1.0",
        status: "SHADOW" as ModelStatus,
        artifact_hash: "e5f6a1b2c3d4...",
        manifest_hash: "b2a1f6e5d4c3...",
        created_at: "2024-12-10T14:00:00Z",
        promoted_at: null,
      },
    ],
    health: {
      status: "HEALTHY",
      latency_p50_ms: 25,
      latency_p95_ms: 65,
      latency_p99_ms: 150,
      error_rate: 0.0005,
      timeout_rate: 0.0001,
      total_inferences: 450000,
    },
  },
  {
    model_id: "exposure-limit-v1",
    domain_type: "EXPOSURE_SCORING",
    description: "Customer exposure limit recommendations",
    versions: [
      {
        model_version_id: "exposure-limit-v1:1.0.0",
        version_label: "1.0.0",
        status: "PRODUCTION" as ModelStatus,
        artifact_hash: "f6a1b2c3d4e5...",
        manifest_hash: "a1f6e5d4c3b2...",
        created_at: "2024-09-01T10:00:00Z",
        promoted_at: "2024-09-20T09:00:00Z",
      },
    ],
    health: {
      status: "DEGRADED",
      latency_p50_ms: 85,
      latency_p95_ms: 350,
      latency_p99_ms: 800,
      error_rate: 0.02,
      timeout_rate: 0.005,
      total_inferences: 75000,
    },
  },
];

// Promotion history
const mockPromotionHistory = [
  {
    id: "PROMO-001",
    model_id: "credit-risk-v1",
    version: "1.1.0",
    from_status: "SHADOW",
    to_status: "CANARY",
    approved_by: "ml-team@turingdynamics.com",
    timestamp: "2024-12-10T11:00:00Z",
    promotion_packet: {
      coverage_percent: 98.5,
      agreement_with_baseline: 0.95,
      latency_p95_ms: 115,
    },
  },
  {
    id: "PROMO-002",
    model_id: "credit-risk-v1",
    version: "1.0.0",
    from_status: "CANARY",
    to_status: "PRODUCTION",
    approved_by: "risk-committee@turingdynamics.com",
    timestamp: "2024-11-15T14:30:00Z",
    promotion_packet: {
      coverage_percent: 99.2,
      agreement_with_baseline: 0.97,
      latency_p95_ms: 118,
    },
  },
  {
    id: "PROMO-003",
    model_id: "fraud-detection-v2",
    version: "2.0.0",
    from_status: "CANARY",
    to_status: "PRODUCTION",
    approved_by: "security-team@turingdynamics.com",
    timestamp: "2024-10-30T16:00:00Z",
    promotion_packet: {
      coverage_percent: 99.8,
      agreement_with_baseline: 0.99,
      latency_p95_ms: 62,
    },
  },
];

function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const config: Record<ModelStatus, { color: string; icon: typeof CheckCircle2 }> = {
    REGISTERED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
    SHADOW: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Eye },
    CANARY: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
    PRODUCTION: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    DEPRECATED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
    REVOKED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  };

  const { color, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function HealthStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    HEALTHY: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    DEGRADED: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
    UNHEALTHY: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
    UNKNOWN: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: HelpCircle },
  };

  const { color, icon: Icon } = config[status] || config.UNKNOWN;

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-AU").format(num);
}

function SummaryCards() {
  const totalModels = mockModels.length;
  const productionModels = mockModels.filter(m => 
    m.versions.some(v => v.status === "PRODUCTION")
  ).length;
  const canaryModels = mockModels.filter(m => 
    m.versions.some(v => v.status === "CANARY")
  ).length;
  const shadowModels = mockModels.filter(m => 
    m.versions.some(v => v.status === "SHADOW")
  ).length;
  const healthyModels = mockModels.filter(m => m.health.status === "HEALTHY").length;
  const totalInferences = mockModels.reduce((sum, m) => sum + m.health.total_inferences, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Total Models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalModels}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registered in system
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-emerald-400">{productionModels}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Serving live traffic
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Canary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-yellow-400">{canaryModels}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Limited rollout
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-400" />
            Shadow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-purple-400">{shadowModels}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Testing mode
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Total Inferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatNumber(totalInferences)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {healthyModels}/{totalModels} healthy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ModelsTable({ onSelectModel }: { onSelectModel: (model: typeof mockModels[0]) => void }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Model Registry
            </CardTitle>
            <CardDescription>All registered ML models with lifecycle status</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model ID</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Production Version</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Latency (p95)</TableHead>
              <TableHead className="text-right">Error Rate</TableHead>
              <TableHead className="text-right">Inferences</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockModels.map((model) => {
              const prodVersion = model.versions.find(v => v.status === "PRODUCTION");
              return (
                <TableRow key={model.model_id} className="cursor-pointer hover:bg-secondary/50">
                  <TableCell className="font-mono text-sm">{model.model_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {model.domain_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {prodVersion ? (
                      <span className="font-mono text-sm">{prodVersion.version_label}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <HealthStatusBadge status={model.health.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {model.health.latency_p95_ms}ms
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(model.health.error_rate * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(model.health.total_inferences)}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onSelectModel(model)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function VersionsTable({ model }: { model: typeof mockModels[0] }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Version History: {model.model_id}
        </CardTitle>
        <CardDescription>{model.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Artifact Hash</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Promoted</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.versions.map((version) => (
              <TableRow key={version.model_version_id}>
                <TableCell className="font-mono text-sm font-medium">
                  {version.version_label}
                </TableCell>
                <TableCell>
                  <ModelStatusBadge status={version.status} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {version.artifact_hash}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(version.created_at)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(version.promoted_at)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {version.status === "SHADOW" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-yellow-400">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Promote to Canary</TooltipContent>
                      </Tooltip>
                    )}
                    {version.status === "CANARY" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-emerald-400">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Promote to Production</TooltipContent>
                      </Tooltip>
                    )}
                    {version.status === "PRODUCTION" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-400">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rollback</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PromotionHistoryTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Promotion History
        </CardTitle>
        <CardDescription>Recent model promotions and rollbacks</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Transition</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Agreement</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockPromotionHistory.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="font-mono text-sm">{promo.model_id}</TableCell>
                <TableCell className="font-mono text-sm">{promo.version}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ModelStatusBadge status={promo.from_status as ModelStatus} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <ModelStatusBadge status={promo.to_status as ModelStatus} />
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  {promo.promotion_packet.coverage_percent}%
                </TableCell>
                <TableCell className="font-mono">
                  {(promo.promotion_packet.agreement_with_baseline * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {promo.approved_by}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(promo.timestamp)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ModelHealthPanel({ model }: { model: typeof mockModels[0] }) {
  const { health } = model;
  
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Health Metrics: {model.model_id}
        </CardTitle>
        <CardDescription>Real-time performance and auto-disable status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Health</span>
          <HealthStatusBadge status={health.status} />
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Latency p50</span>
              <span className="font-mono">{health.latency_p50_ms}ms</span>
            </div>
            <Progress value={Math.min(health.latency_p50_ms / 200 * 100, 100)} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Latency p95</span>
              <span className="font-mono">{health.latency_p95_ms}ms</span>
            </div>
            <Progress 
              value={Math.min(health.latency_p95_ms / 500 * 100, 100)} 
              className={`h-2 ${health.latency_p95_ms > 300 ? '[&>div]:bg-yellow-500' : ''}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Latency p99</span>
              <span className="font-mono">{health.latency_p99_ms}ms</span>
            </div>
            <Progress 
              value={Math.min(health.latency_p99_ms / 1000 * 100, 100)} 
              className={`h-2 ${health.latency_p99_ms > 500 ? '[&>div]:bg-red-500' : ''}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Error Rate</span>
              <span className={`font-mono ${health.error_rate > 0.01 ? 'text-red-400' : ''}`}>
                {(health.error_rate * 100).toFixed(3)}%
              </span>
            </div>
            <Progress 
              value={Math.min(health.error_rate * 1000, 100)} 
              className={`h-2 ${health.error_rate > 0.01 ? '[&>div]:bg-red-500' : ''}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Timeout Rate</span>
              <span className="font-mono">{(health.timeout_rate * 100).toFixed(4)}%</span>
            </div>
            <Progress value={Math.min(health.timeout_rate * 10000, 100)} className="h-2" />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">Auto-Disable Triggers</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Latency Threshold (p95 &gt; 500ms)
              </span>
              <Badge variant="outline" className={
                health.latency_p95_ms > 500 
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }>
                {health.latency_p95_ms > 500 ? "TRIGGERED" : "OK"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Error Rate Threshold (&gt; 1%)
              </span>
              <Badge variant="outline" className={
                health.error_rate > 0.01 
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }>
                {health.error_rate > 0.01 ? "TRIGGERED" : "OK"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeout Rate Threshold (&gt; 0.5%)
              </span>
              <Badge variant="outline" className={
                health.timeout_rate > 0.005 
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }>
                {health.timeout_rate > 0.005 ? "TRIGGERED" : "OK"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MLModelsDashboard() {
  const [selectedModel, setSelectedModel] = useState<typeof mockModels[0] | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Brain className="h-6 w-6 text-white" />
            </div>
            ML Models
          </h1>
          <p className="text-muted-foreground mt-1">
            Model registry, lifecycle management, and health monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-purple-500/30 text-purple-400 bg-purple-500/10">
            <Shield className="h-3 w-3" />
            Governance Enforced
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <ModelsTable onSelectModel={(model) => {
            setSelectedModel(model);
            setActiveTab("versions");
          }} />
        </TabsContent>

        <TabsContent value="versions" className="space-y-4 mt-4">
          {selectedModel ? (
            <VersionsTable model={selectedModel} />
          ) : (
            <Card className="glass-panel">
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a model from the Overview tab to view version history
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="promotions" className="space-y-4 mt-4">
          <PromotionHistoryTable />
        </TabsContent>

        <TabsContent value="health" className="space-y-4 mt-4">
          {selectedModel ? (
            <ModelHealthPanel model={selectedModel} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mockModels.map((model) => (
                <Card 
                  key={model.model_id} 
                  className="glass-panel cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedModel(model)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono">{model.model_id}</CardTitle>
                    <CardDescription>{model.domain_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <HealthStatusBadge status={model.health.status} />
                      <span className="text-sm text-muted-foreground">
                        p95: {model.health.latency_p95_ms}ms
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Model Detail Dialog */}
      <Dialog open={!!selectedModel && activeTab === "overview"} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {selectedModel?.model_id}
            </DialogTitle>
            <DialogDescription>{selectedModel?.description}</DialogDescription>
          </DialogHeader>
          {selectedModel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Domain</span>
                  <p className="font-medium">{selectedModel.domain_type}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Health</span>
                  <p><HealthStatusBadge status={selectedModel.health.status} /></p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Versions</span>
                  <p className="font-medium">{selectedModel.versions.length}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Inferences</span>
                  <p className="font-medium">{formatNumber(selectedModel.health.total_inferences)}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setActiveTab("versions")}>
                  View Versions
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("health")}>
                  View Health
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
