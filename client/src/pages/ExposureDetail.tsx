import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
  Activity,
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileJson,
  Copy,
  ExternalLink,
  RefreshCw,
  History,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

// Mock data for a specific customer
const mockCustomerData = {
  customerId: "CUST-AU-67890",
  customerName: "Sarah Johnson",
  currentSnapshot: {
    totalExposure: 125000,
    lendingExposure: 110000,
    paymentsPending: 15000,
    holdsExposure: 0,
    currency: "AUD",
    asOfLedgerEvent: 45890,
    snapshotHash: "a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    timestamp: "2024-12-16T11:15:00Z",
  },
  // Product type breakdown (new dimension)
  productBreakdown: [
    { productType: "personal_loan", amount: 50000, count: 1 },
    { productType: "credit_card", amount: 35000, count: 2 },
    { productType: "overdraft", amount: 25000, count: 1 },
  ],
  // Time-based exposure (new dimension)
  timeBasedExposure: {
    last30Days: { added: 25000, removed: 5000, net: 20000 },
    last60Days: { added: 45000, removed: 10000, net: 35000 },
    last90Days: { added: 60000, removed: 15000, net: 45000 },
  },
  // Velocity metrics (new dimension)
  velocityMetrics: {
    dailyAvgChange: 2500,
    weeklyAvgChange: 12000,
    monthlyAvgChange: 35000,
    trend: "increasing",
  },
  // Recent decisions
  recentDecisions: [
    {
      decisionId: "DEC-LEND-2024-002",
      type: "lending",
      amount: 40000,
      outcome: "REVIEW",
      timestamp: "2024-12-16T11:15:00Z",
      blocked: true,
      reason: "Exposure limits breached",
    },
    {
      decisionId: "DEC-PAY-2024-005",
      type: "payment",
      amount: 5000,
      outcome: "ALLOW",
      timestamp: "2024-12-16T09:30:00Z",
      blocked: false,
      reason: null,
    },
    {
      decisionId: "DEC-LEND-2024-001",
      type: "lending",
      amount: 35000,
      outcome: "ALLOW",
      timestamp: "2024-12-15T14:00:00Z",
      blocked: false,
      reason: null,
    },
  ],
  // Historical snapshots
  historicalSnapshots: [
    { asOfLedgerEvent: 45890, totalExposure: 125000, timestamp: "2024-12-16T11:15:00Z" },
    { asOfLedgerEvent: 45800, totalExposure: 120000, timestamp: "2024-12-16T09:30:00Z" },
    { asOfLedgerEvent: 45700, totalExposure: 85000, timestamp: "2024-12-15T14:00:00Z" },
    { asOfLedgerEvent: 45600, totalExposure: 80000, timestamp: "2024-12-14T16:45:00Z" },
    { asOfLedgerEvent: 45500, totalExposure: 75000, timestamp: "2024-12-13T10:00:00Z" },
  ],
};

const limits = {
  totalCap: 150000,
  lendingCap: 120000,
  paymentsPendingCap: 20000,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getUtilizationColor(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-green-500";
}

function CapUtilizationGauge({ 
  label, 
  current, 
  cap, 
  policyId 
}: { 
  label: string; 
  current: number; 
  cap: number; 
  policyId: string;
}) {
  const percent = Math.round((current / cap) * 100);
  const headroom = cap - current;
  const isBreached = current > cap;
  const isWarning = percent >= 80;

  return (
    <div className="space-y-3 p-4 rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="text-xs font-mono">{policyId}</Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono">{formatCurrency(current)}</span>
          <span className="text-muted-foreground">of {formatCurrency(cap)}</span>
        </div>
        <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${isBreached ? "bg-red-500" : getUtilizationColor(percent)}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={isBreached ? "text-red-500 font-medium" : isWarning ? "text-yellow-500" : "text-muted-foreground"}>
            {percent}% utilized
          </span>
          <span className={headroom < 0 ? "text-red-500" : "text-green-500"}>
            {headroom >= 0 ? `${formatCurrency(headroom)} headroom` : `${formatCurrency(Math.abs(headroom))} over limit`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ExposureDetail() {
  const params = useParams();
  const customerId = params.id || "CUST-AU-67890";
  const [activeTab, setActiveTab] = useState("snapshot");

  const data = mockCustomerData;
  const snapshot = data.currentSnapshot;
  const totalUtilization = Math.round((snapshot.totalExposure / limits.totalCap) * 100);

  const copyHash = () => {
    navigator.clipboard.writeText(snapshot.snapshotHash);
    toast.success("Hash copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/exposure">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{data.customerName}</h1>
          <p className="text-muted-foreground font-mono">{data.customerId}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUtilization >= 80 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              High Risk
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
              <Shield className="h-3 w-3" />
              Normal
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Snapshot Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(snapshot.totalExposure)}</div>
            <Progress value={totalUtilization} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{totalUtilization}% of limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Lending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(snapshot.lendingExposure)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((snapshot.lendingExposure / limits.lendingCap) * 100)}% of {formatCurrency(limits.lendingCap)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Payments Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(snapshot.paymentsPending)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((snapshot.paymentsPending / limits.paymentsPendingCap) * 100)}% of {formatCurrency(limits.paymentsPendingCap)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              30-Day Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono flex items-center gap-2">
              {data.velocityMetrics.trend === "increasing" ? (
                <TrendingUp className="h-5 w-5 text-red-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-500" />
              )}
              {formatCurrency(data.timeBasedExposure.last30Days.net)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Net change this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="snapshot">Snapshot Details</TabsTrigger>
          <TabsTrigger value="dimensions">Exposure Dimensions</TabsTrigger>
          <TabsTrigger value="limits">Limit Utilization</TabsTrigger>
          <TabsTrigger value="decisions">Recent Decisions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Snapshot Details Tab */}
        <TabsContent value="snapshot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Current Exposure Snapshot
              </CardTitle>
              <CardDescription>
                Immutable, hashable snapshot as of ledger event #{snapshot.asOfLedgerEvent}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Customer ID</span>
                    <span className="font-mono">{data.customerId}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Total Exposure</span>
                    <span className="font-mono font-medium">{formatCurrency(snapshot.totalExposure)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Lending Exposure</span>
                    <span className="font-mono">{formatCurrency(snapshot.lendingExposure)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Payments Pending</span>
                    <span className="font-mono">{formatCurrency(snapshot.paymentsPending)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Holds</span>
                    <span className="font-mono">{formatCurrency(snapshot.holdsExposure)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-mono">{snapshot.currency}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Ledger Event</span>
                    <span className="font-mono">#{snapshot.asOfLedgerEvent}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Timestamp</span>
                    <span className="text-sm">{formatDate(snapshot.timestamp)}</span>
                  </div>
                  <div className="py-2">
                    <span className="text-muted-foreground block mb-2">Snapshot Hash</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-secondary p-2 rounded font-mono break-all">
                        {snapshot.snapshotHash}
                      </code>
                      <Button variant="ghost" size="icon" onClick={copyHash}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  Raw JSON
                </h4>
                <pre className="text-xs bg-secondary p-4 rounded-lg overflow-auto max-h-64 font-mono">
{JSON.stringify({
  customer_id: data.customerId,
  total_exposure: snapshot.totalExposure.toString(),
  lending_exposure: snapshot.lendingExposure.toString(),
  payments_pending_exposure: snapshot.paymentsPending.toString(),
  holds_exposure: snapshot.holdsExposure.toString(),
  currency: snapshot.currency,
  as_of_ledger_event: snapshot.asOfLedgerEvent,
  snapshot_hash: snapshot.snapshotHash,
}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exposure Dimensions Tab */}
        <TabsContent value="dimensions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Product Type Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product Type Breakdown</CardTitle>
                <CardDescription>Exposure by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.productBreakdown.map((product) => (
                    <div key={product.productType} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm capitalize">{product.productType.replace("_", " ")}</span>
                        <span className="font-mono text-sm">{formatCurrency(product.amount)}</span>
                      </div>
                      <Progress 
                        value={(product.amount / snapshot.totalExposure) * 100} 
                        className="h-2"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{product.count} active</span>
                        <span>{Math.round((product.amount / snapshot.totalExposure) * 100)}% of total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time-based Exposure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Time-based Exposure</CardTitle>
                <CardDescription>Exposure changes over time windows</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Window</TableHead>
                      <TableHead className="text-right">Added</TableHead>
                      <TableHead className="text-right">Removed</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>30 Days</TableCell>
                      <TableCell className="text-right text-red-500">+{formatCurrency(data.timeBasedExposure.last30Days.added)}</TableCell>
                      <TableCell className="text-right text-green-500">-{formatCurrency(data.timeBasedExposure.last30Days.removed)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(data.timeBasedExposure.last30Days.net)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>60 Days</TableCell>
                      <TableCell className="text-right text-red-500">+{formatCurrency(data.timeBasedExposure.last60Days.added)}</TableCell>
                      <TableCell className="text-right text-green-500">-{formatCurrency(data.timeBasedExposure.last60Days.removed)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(data.timeBasedExposure.last60Days.net)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>90 Days</TableCell>
                      <TableCell className="text-right text-red-500">+{formatCurrency(data.timeBasedExposure.last90Days.added)}</TableCell>
                      <TableCell className="text-right text-green-500">-{formatCurrency(data.timeBasedExposure.last90Days.removed)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(data.timeBasedExposure.last90Days.net)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Velocity Metrics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Velocity Metrics</CardTitle>
                <CardDescription>Rate of exposure change</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 bg-secondary/30 rounded-lg">
                    <div className="text-2xl font-bold font-mono">{formatCurrency(data.velocityMetrics.dailyAvgChange)}</div>
                    <div className="text-sm text-muted-foreground">Daily Avg Change</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/30 rounded-lg">
                    <div className="text-2xl font-bold font-mono">{formatCurrency(data.velocityMetrics.weeklyAvgChange)}</div>
                    <div className="text-sm text-muted-foreground">Weekly Avg Change</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/30 rounded-lg">
                    <div className="text-2xl font-bold font-mono">{formatCurrency(data.velocityMetrics.monthlyAvgChange)}</div>
                    <div className="text-sm text-muted-foreground">Monthly Avg Change</div>
                  </div>
                  <div className="text-center p-4 bg-secondary/30 rounded-lg">
                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                      {data.velocityMetrics.trend === "increasing" ? (
                        <>
                          <TrendingUp className="h-6 w-6 text-red-500" />
                          <span className="text-red-500">Increasing</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-6 w-6 text-green-500" />
                          <span className="text-green-500">Decreasing</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">Trend</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Limit Utilization Tab */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AU v1 Limit Utilization</CardTitle>
              <CardDescription>
                Current exposure against configured policy limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <CapUtilizationGauge
                  label="Total Exposure Cap"
                  current={snapshot.totalExposure}
                  cap={limits.totalCap}
                  policyId="LIMIT-AU-TOTAL-001"
                />
                <CapUtilizationGauge
                  label="Lending Exposure Cap"
                  current={snapshot.lendingExposure}
                  cap={limits.lendingCap}
                  policyId="LIMIT-AU-LENDING-001"
                />
                <CapUtilizationGauge
                  label="Pending Payments Cap"
                  current={snapshot.paymentsPending}
                  cap={limits.paymentsPendingCap}
                  policyId="LIMIT-AU-PAYPEND-001"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Headroom Calculator</CardTitle>
              <CardDescription>
                Available capacity before hitting limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold font-mono text-green-500">
                    {formatCurrency(Math.max(0, limits.totalCap - snapshot.totalExposure))}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Total Headroom</div>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold font-mono text-green-500">
                    {formatCurrency(Math.max(0, limits.lendingCap - snapshot.lendingExposure))}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Lending Headroom</div>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg text-center">
                  <div className="text-3xl font-bold font-mono text-green-500">
                    {formatCurrency(Math.max(0, limits.paymentsPendingCap - snapshot.paymentsPending))}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Payments Headroom</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Decisions Tab */}
        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Exposure-Driven Decisions</CardTitle>
              <CardDescription>
                Decisions evaluated against this customer's exposure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Decision ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentDecisions.map((decision) => (
                    <TableRow key={decision.decisionId}>
                      <TableCell className="font-mono text-sm">{decision.decisionId}</TableCell>
                      <TableCell className="capitalize">{decision.type}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(decision.amount)}</TableCell>
                      <TableCell>
                        {decision.outcome === "ALLOW" ? (
                          <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
                            <CheckCircle2 className="h-3 w-3" />
                            ALLOW
                          </Badge>
                        ) : decision.outcome === "REVIEW" ? (
                          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500">
                            <AlertTriangle className="h-3 w-3" />
                            REVIEW
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            DECLINE
                          </Badge>
                        )}
                        {decision.blocked && (
                          <Badge variant="destructive" className="ml-2 gap-1">
                            Blocked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(decision.timestamp)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/decisions/${decision.decisionId}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-4 w-4" />
                            View Evidence
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historical Snapshots
              </CardTitle>
              <CardDescription>
                Previous exposure states for replay and comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ledger Event</TableHead>
                    <TableHead>Total Exposure</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.historicalSnapshots.map((snap, index) => {
                    const prevSnap = data.historicalSnapshots[index + 1];
                    const change = prevSnap ? snap.totalExposure - prevSnap.totalExposure : 0;
                    return (
                      <TableRow key={snap.asOfLedgerEvent}>
                        <TableCell className="font-mono">#{snap.asOfLedgerEvent}</TableCell>
                        <TableCell className="font-mono font-medium">{formatCurrency(snap.totalExposure)}</TableCell>
                        <TableCell>
                          {change !== 0 && (
                            <span className={change > 0 ? "text-red-500" : "text-green-500"}>
                              {change > 0 ? "+" : ""}{formatCurrency(change)}
                            </span>
                          )}
                          {change === 0 && index === data.historicalSnapshots.length - 1 && (
                            <span className="text-muted-foreground">Initial</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(snap.timestamp)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1">
                            <RefreshCw className="h-4 w-4" />
                            Replay
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
