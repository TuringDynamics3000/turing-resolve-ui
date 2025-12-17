import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  FileText,
  Download,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  Clock,
  FileSpreadsheet,
  FileType,
  Eye,
  RefreshCw,
  Building2,
  Scale,
  Activity,
  BarChart3,
  PieChart,
} from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Types
interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface ComplianceMetrics {
  total_decisions: number;
  approved: number;
  rejected: number;
  review: number;
  approval_rate: number;
  avg_processing_time_ms: number;
  policy_violations: number;
  audit_completeness: number;
  evidence_attached: number;
}

interface AuditEntry {
  id: string;
  decision_id: string;
  timestamp: Date;
  outcome: "APPROVED" | "REJECTED" | "REVIEW";
  request_type: string;
  risk_score: number;
  policy_version: string;
  evidence_hash: string;
  reviewer?: string;
}

interface ReportConfig {
  dateRange: DateRange;
  requestTypes: string[];
  outcomes: string[];
  includeEvidence: boolean;
  includeRiskBreakdown: boolean;
  includeTimeline: boolean;
}

// Mock data
const mockMetrics: ComplianceMetrics = {
  total_decisions: 12847,
  approved: 8923,
  rejected: 2156,
  review: 1768,
  approval_rate: 0.694,
  avg_processing_time_ms: 142,
  policy_violations: 23,
  audit_completeness: 0.998,
  evidence_attached: 0.995,
};

const mockAuditEntries: AuditEntry[] = [
  {
    id: "1",
    decision_id: "DEC-2024-012847",
    timestamp: new Date("2024-12-17T14:30:00"),
    outcome: "APPROVED",
    request_type: "LOAN_APPLICATION",
    risk_score: 0.23,
    policy_version: "v2.3.1",
    evidence_hash: "sha256:a1b2c3d4e5f6...",
  },
  {
    id: "2",
    decision_id: "DEC-2024-012846",
    timestamp: new Date("2024-12-17T14:15:00"),
    outcome: "REJECTED",
    request_type: "CREDIT_LIMIT_INCREASE",
    risk_score: 0.78,
    policy_version: "v2.3.1",
    evidence_hash: "sha256:f6e5d4c3b2a1...",
    reviewer: "compliance_bot",
  },
  {
    id: "3",
    decision_id: "DEC-2024-012845",
    timestamp: new Date("2024-12-17T14:00:00"),
    outcome: "REVIEW",
    request_type: "LOAN_APPLICATION",
    risk_score: 0.52,
    policy_version: "v2.3.1",
    evidence_hash: "sha256:1a2b3c4d5e6f...",
    reviewer: "john.smith",
  },
  {
    id: "4",
    decision_id: "DEC-2024-012844",
    timestamp: new Date("2024-12-17T13:45:00"),
    outcome: "APPROVED",
    request_type: "PAYMENT_AUTHORIZATION",
    risk_score: 0.15,
    policy_version: "v2.3.1",
    evidence_hash: "sha256:6f5e4d3c2b1a...",
  },
  {
    id: "5",
    decision_id: "DEC-2024-012843",
    timestamp: new Date("2024-12-17T13:30:00"),
    outcome: "APPROVED",
    request_type: "LOAN_APPLICATION",
    risk_score: 0.31,
    policy_version: "v2.3.1",
    evidence_hash: "sha256:b1c2d3e4f5a6...",
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

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = "primary" 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: any;
  trend?: number;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 border-primary/20 text-primary",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/20 text-red-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
  };
  const colorClasses = colorMap[color] || colorMap.primary;

  return (
    <Card className="glass-panel">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            <TrendingUp className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`} />
            {trend >= 0 ? "+" : ""}{trend}% vs last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComplianceReport() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>(["all"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleGenerateReport = async (format: "pdf" | "csv") => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGenerating(false);
    toast.success(`${format.toUpperCase()} report generated`, {
      description: `compliance-report-${new Date().toISOString().split('T')[0]}.${format}`,
    });
  };

  const handleQuickRange = (range: "today" | "week" | "month" | "quarter") => {
    const now = new Date();
    switch (range) {
      case "today":
        setDateRange({ from: now, to: now });
        break;
      case "week":
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "quarter":
        setDateRange({ from: subMonths(now, 3), to: now });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20">
            <FileText className="h-8 w-8 text-orange-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Compliance Report Generator
            </h1>
            <p className="text-muted-foreground">Generate audit-ready compliance reports and exports</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleGenerateReport("csv")} disabled={isGenerating}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => handleGenerateReport("pdf")} disabled={isGenerating}>
              <FileType className="h-4 w-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-panel mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary/30">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "Select range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickRange("today")}>Today</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickRange("week")}>Week</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickRange("month")}>Month</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleQuickRange("quarter")}>Quarter</Button>
                </div>
              </div>

              {/* Request Type */}
              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={selectedTypes[0]} onValueChange={(v) => setSelectedTypes([v])}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="LOAN_APPLICATION">Loan Application</SelectItem>
                    <SelectItem value="CREDIT_LIMIT_INCREASE">Credit Limit Increase</SelectItem>
                    <SelectItem value="PAYMENT_AUTHORIZATION">Payment Authorization</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome Filter */}
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select value={selectedOutcomes[0]} onValueChange={(v) => setSelectedOutcomes([v])}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="REVIEW">Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Policy Version */}
              <div className="space-y-2">
                <Label>Policy Version</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="All versions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Versions</SelectItem>
                    <SelectItem value="v2.3.1">v2.3.1 (Current)</SelectItem>
                    <SelectItem value="v2.3.0">v2.3.0</SelectItem>
                    <SelectItem value="v2.2.0">v2.2.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Shield className="h-4 w-4 mr-2" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <Scale className="h-4 w-4 mr-2" />
              Compliance Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Metrics */}
            <div className="grid md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Decisions"
                value={mockMetrics.total_decisions.toLocaleString()}
                subtitle="In selected period"
                icon={Activity}
                trend={5.2}
              />
              <MetricCard
                title="Approval Rate"
                value={`${(mockMetrics.approval_rate * 100).toFixed(1)}%`}
                subtitle={`${mockMetrics.approved.toLocaleString()} approved`}
                icon={CheckCircle2}
                color="emerald"
                trend={2.1}
              />
              <MetricCard
                title="Avg Processing Time"
                value={`${mockMetrics.avg_processing_time_ms}ms`}
                subtitle="Per decision"
                icon={Clock}
                trend={-8.3}
              />
              <MetricCard
                title="Policy Violations"
                value={mockMetrics.policy_violations}
                subtitle="Flagged for review"
                icon={AlertTriangle}
                color="amber"
                trend={-15.2}
              />
            </div>

            {/* Decision Distribution */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-orange-400" />
                  Decision Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        Approved
                      </span>
                      <span className="font-mono">{mockMetrics.approved.toLocaleString()}</span>
                    </div>
                    <Progress value={(mockMetrics.approved / mockMetrics.total_decisions) * 100} className="h-2 bg-emerald-500/20" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        Rejected
                      </span>
                      <span className="font-mono">{mockMetrics.rejected.toLocaleString()}</span>
                    </div>
                    <Progress value={(mockMetrics.rejected / mockMetrics.total_decisions) * 100} className="h-2 bg-red-500/20" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        Review
                      </span>
                      <span className="font-mono">{mockMetrics.review.toLocaleString()}</span>
                    </div>
                    <Progress value={(mockMetrics.review / mockMetrics.total_decisions) * 100} className="h-2 bg-amber-500/20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-orange-400" />
                      Audit Trail
                    </CardTitle>
                    <CardDescription>Complete decision history with evidence hashes</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Decision ID</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Evidence Hash</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockAuditEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">{entry.decision_id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(entry.timestamp, "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {entry.request_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <OutcomeBadge outcome={entry.outcome} />
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-sm ${
                            entry.risk_score > 0.6 ? "text-red-400" : 
                            entry.risk_score > 0.4 ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {(entry.risk_score * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.evidence_hash}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Audit Completeness */}
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Audit Completeness
                  </CardTitle>
                  <CardDescription>Percentage of decisions with complete audit trails</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-emerald-400">
                      {(mockMetrics.audit_completeness * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {Math.round(mockMetrics.total_decisions * mockMetrics.audit_completeness).toLocaleString()} of {mockMetrics.total_decisions.toLocaleString()} decisions
                    </p>
                  </div>
                  <Progress value={mockMetrics.audit_completeness * 100} className="h-3" />
                </CardContent>
              </Card>

              {/* Evidence Attachment Rate */}
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-400" />
                    Evidence Attachment Rate
                  </CardTitle>
                  <CardDescription>Decisions with cryptographic evidence attached</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-orange-400">
                      {(mockMetrics.evidence_attached * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      SHA-256 hashed evidence packages
                    </p>
                  </div>
                  <Progress value={mockMetrics.evidence_attached * 100} className="h-3" />
                </CardContent>
              </Card>

              {/* Regulatory Compliance */}
              <Card className="glass-panel md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-orange-400" />
                    Regulatory Compliance Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { name: "Decision Audit Trail", status: "pass", description: "All decisions logged with timestamps" },
                      { name: "Evidence Integrity", status: "pass", description: "Cryptographic hashes verified" },
                      { name: "Policy Version Tracking", status: "pass", description: "All policy changes documented" },
                      { name: "Manual Review Compliance", status: "pass", description: "High-risk decisions reviewed" },
                      { name: "Data Retention", status: "pass", description: "7-year retention policy enforced" },
                      { name: "Access Control", status: "pass", description: "Role-based access verified" },
                    ].map((item) => (
                      <div key={item.name} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
