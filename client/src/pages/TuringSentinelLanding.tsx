import { useState } from "react";
import { Link } from "wouter";
import { CommandBreakdownChart } from "@/components/CommandBreakdownChart";
import { LiveDecisionFeed } from "@/components/LiveDecisionFeed";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  Eye, 
  Lock, 
  FileCheck, 
  Users, 
  Activity,
  ChevronRight,
  CheckCircle2,
  Fingerprint,
  Scale,
  Zap,
  Database,
  GitBranch,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Download,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const SENTINEL_FEATURES = [
  {
    icon: Shield,
    title: "Role-Based Access Control",
    description: "Granular permissions with maker/checker workflows. Every action requires proper authority.",
    href: "/sentinel/console",
    color: "amber"
  },
  {
    icon: Fingerprint,
    title: "Cryptographic Evidence",
    description: "Every decision generates a signed evidence pack with Merkle inclusion proof.",
    href: "/evidence",
    color: "cyan"
  },
  {
    icon: Eye,
    title: "Complete Audit Trail",
    description: "Authority facts record who did what, when, and why — immutably.",
    href: "/sentinel/console",
    color: "purple"
  },
  {
    icon: Lock,
    title: "Forbidden Commands",
    description: "Architecturally blocked operations that no role can execute. Ever.",
    href: "/governance-controls",
    color: "red"
  },
  {
    icon: Scale,
    title: "Policy DSL",
    description: "Deterministic policy evaluation with replay guarantees.",
    href: "/policies",
    color: "emerald"
  },
  {
    icon: GitBranch,
    title: "Model Governance",
    description: "ML model lifecycle with shadow → canary → production promotion gates.",
    href: "/ml-models",
    color: "blue"
  }
];

const COMPETITIVE_ADVANTAGES = [
  {
    us: "Cryptographic proof of every decision",
    them: "Audit logs that can be modified"
  },
  {
    us: "Merkle-anchored evidence packs",
    them: "Database records"
  },
  {
    us: "Deterministic replay guarantees",
    them: "Point-in-time snapshots"
  },
  {
    us: "Architecturally forbidden commands",
    them: "Role-based restrictions only"
  }
];

function getColorClasses(color: string) {
  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: "text-amber-400" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", icon: "text-cyan-400" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", icon: "text-purple-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: "text-red-400" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: "text-emerald-400" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: "text-blue-400" },
  };
  return colors[color] || colors.amber;
}

function StatSkeleton() {
  return (
    <div className="text-center">
      <Skeleton className="h-9 w-20 mx-auto mb-2 bg-zinc-800" />
      <Skeleton className="h-4 w-32 mx-auto bg-zinc-800" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[300px] flex items-center justify-center">
      <div className="text-center">
        <Skeleton className="h-8 w-8 mx-auto mb-2 bg-zinc-800 rounded-full" />
        <Skeleton className="h-4 w-32 mx-auto bg-zinc-800" />
      </div>
    </div>
  );
}

type Period = "24h" | "7d" | "30d";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-zinc-400 text-sm mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-emerald-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Allowed: <span className="font-semibold">{payload[0]?.value || 0}</span>
          </p>
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Denied: <span className="font-semibold">{payload[1]?.value || 0}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const DOMAINS = ["ALL", "DEPOSITS", "PAYMENTS", "LENDING", "ML", "POLICY"] as const;
type Domain = typeof DOMAINS[number];

export default function TuringSentinelLanding() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7d");
  const [selectedDomain, setSelectedDomain] = useState<Domain>("ALL");
  const [isExporting, setIsExporting] = useState(false);
  
  const domainFilter = selectedDomain === "ALL" ? undefined : selectedDomain;
  
  // Fetch live metrics from tRPC
  const { data: metrics, isLoading, refetch } = trpc.rbac.getSentinelMetrics.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch decision trends for chart
  const { data: trends, isLoading: trendsLoading } = trpc.rbac.getDecisionTrends.useQuery(
    { period: selectedPeriod },
    { refetchInterval: 60000 } // Refresh every minute
  );
  
  // CSV export query
  const { refetch: fetchCSV } = trpc.rbac.exportAuthorityFactsCSV.useQuery(
    { domain: domainFilter },
    { enabled: false }
  );
  
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const result = await fetchCSV();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `authority-facts-${selectedDomain.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.count} records to CSV`);
      }
    } catch (error) {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        
        <div className="container relative py-16">
          <div className="flex items-center gap-6 mb-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Shield className="h-12 w-12 text-amber-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                TuringSentinel
              </h1>
              <p className="text-xl text-zinc-400 mt-1">Vigilant governance, provable decisions</p>
            </div>
          </div>

          <div className="max-w-3xl mb-12">
            <p className="text-lg text-zinc-300 leading-relaxed">
              TuringSentinel is the command center for TuringDynamics governance. Unlike traditional 
              audit logs, every decision generates <span className="text-amber-400 font-semibold">cryptographic proof</span> that 
              can be independently verified. When a regulator asks "prove this decision was correct," 
              you don't show a log — you show a <span className="text-cyan-400 font-semibold">signed evidence pack</span>.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/sentinel/console">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                <Shield className="h-5 w-5 mr-2" />
                Open Console
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/evidence">
              <Button size="lg" variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                <FileCheck className="h-5 w-5 mr-2" />
                View Evidence Vault
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Bar - Live Data */}
      <div className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-zinc-400">Live Metrics</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-8">
            {isLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400">
                    {metrics?.totalDecisions.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-zinc-500 uppercase tracking-wider">Authority Decisions</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-400">
                    {metrics?.autoApprovalRate || 0}%
                  </p>
                  <p className="text-sm text-zinc-500 uppercase tracking-wider">Auto-Approved</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-cyan-400">
                    {metrics?.activeRoleAssignments || 0}
                  </p>
                  <p className="text-sm text-zinc-500 uppercase tracking-wider">Active Role Assignments</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-400">
                    {metrics?.evidencePacksVerified || 100}%
                  </p>
                  <p className="text-sm text-zinc-500 uppercase tracking-wider">Evidence Packs Verified</p>
                </div>
              </>
            )}
          </div>
          
          {/* Additional stats row */}
          <div className="grid grid-cols-3 gap-8 mt-6 pt-6 border-t border-zinc-800">
            {isLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {metrics?.allowedCount.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Allowed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {metrics?.deniedCount.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Denied</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">
                    {metrics?.pendingApprovals || 0}
                  </p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Pending Approvals</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Decision Trends Chart */}
      <div className="container py-12">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-zinc-100">Decision Trends</CardTitle>
                  <CardDescription className="text-zinc-500">Authority decisions over time</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["24h", "7d", "30d"] as Period[]).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className={selectedPeriod === period 
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30" 
                      : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    }
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trends || []}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDenied" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#71717a" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: '#27272a' }}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: '#27272a' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-zinc-400 text-sm">{value}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="allowed"
                      name="Allowed"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAllowed)"
                    />
                    <Area
                      type="monotone"
                      dataKey="denied"
                      name="Denied"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDenied)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Domain Filter and Export */}
      <div className="container pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">Filter by Domain:</span>
            </div>
            <Select value={selectedDomain} onValueChange={(v) => setSelectedDomain(v as Domain)}>
              <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOMAINS.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain === "ALL" ? "All Domains" : domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Command Breakdown and Live Feed */}
      <div className="container pb-12">
        <div className="grid grid-cols-2 gap-6">
          <CommandBreakdownChart domain={domainFilter} />
          <LiveDecisionFeed domain={domainFilter} />
        </div>
      </div>

      {/* Features Grid */}
      <div className="container py-12">
        <h2 className="text-2xl font-bold text-zinc-100 mb-8">Governance Capabilities</h2>
        <div className="grid grid-cols-3 gap-6">
          {SENTINEL_FEATURES.map((feature) => {
            const colors = getColorClasses(feature.color);
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className={`bg-zinc-900/50 border-zinc-800 hover:${colors.border} transition-all cursor-pointer group`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <feature.icon className={`h-6 w-6 ${colors.icon}`} />
                      </div>
                      <CardTitle className="text-lg text-zinc-100 group-hover:text-zinc-50">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-400 text-sm">{feature.description}</p>
                    <div className="flex items-center gap-1 mt-4 text-sm text-zinc-500 group-hover:text-zinc-400">
                      Learn more <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Competitive Advantage Section */}
      <div className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="container py-12">
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">Why TuringSentinel</h2>
          <p className="text-zinc-400 mb-8">vs. traditional governance consoles</p>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">TuringSentinel</Badge>
              </div>
              <div className="space-y-3">
                {COMPETITIVE_ADVANTAGES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-zinc-200">{item.us}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-zinc-500 border-zinc-700">Traditional Consoles</Badge>
              </div>
              <div className="space-y-3">
                {COMPETITIVE_ADVANTAGES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                    <div className="h-5 w-5 rounded-full border border-zinc-700 flex-shrink-0" />
                    <span className="text-zinc-500">{item.them}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="container py-12">
        <h2 className="text-2xl font-bold text-zinc-100 mb-8">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          <Link href="/sentinel/console">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-400" />
                <span className="text-zinc-200">Manage Roles</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/sentinel/console">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-cyan-400" />
                <span className="text-zinc-200">Review Approvals</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/evidence">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-purple-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-purple-400" />
                <span className="text-zinc-200">Verify Evidence</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/governance-controls">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-red-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-red-400" />
                <span className="text-zinc-200">View Boundaries</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
