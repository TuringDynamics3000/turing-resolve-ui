import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Search,
  RefreshCw,
  ChevronRight,
  Activity,
  DollarSign,
  CreditCard,
  Wallet,
  Clock,
  Hash,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { Link } from "wouter";

// Mock data for exposure snapshots
const mockCustomerExposures = [
  {
    customerId: "CUST-AU-12345",
    customerName: "John Smith",
    totalExposure: 80000,
    lendingExposure: 80000,
    paymentsPending: 0,
    holdsExposure: 0,
    currency: "AUD",
    asOfLedgerEvent: 46000,
    snapshotHash: "e7f8a9b0c1d2e3f4",
    lastUpdated: "2024-12-16T10:30:00Z",
    riskLevel: "low",
    utilizationPercent: 53,
  },
  {
    customerId: "CUST-AU-67890",
    customerName: "Sarah Johnson",
    totalExposure: 125000,
    lendingExposure: 110000,
    paymentsPending: 15000,
    holdsExposure: 0,
    currency: "AUD",
    asOfLedgerEvent: 45890,
    snapshotHash: "a9b0c1d2e3f4a5b6",
    lastUpdated: "2024-12-16T11:15:00Z",
    riskLevel: "high",
    utilizationPercent: 83,
  },
  {
    customerId: "CUST-AU-11111",
    customerName: "Michael Chen",
    totalExposure: 45000,
    lendingExposure: 40000,
    paymentsPending: 5000,
    holdsExposure: 0,
    currency: "AUD",
    asOfLedgerEvent: 46100,
    snapshotHash: "b0c1d2e3f4a5b6c7",
    lastUpdated: "2024-12-16T14:00:00Z",
    riskLevel: "low",
    utilizationPercent: 30,
  },
  {
    customerId: "CUST-AU-22222",
    customerName: "Emma Wilson",
    totalExposure: 95000,
    lendingExposure: 85000,
    paymentsPending: 8000,
    holdsExposure: 2000,
    currency: "AUD",
    asOfLedgerEvent: 46050,
    snapshotHash: "c1d2e3f4a5b6c7d8",
    lastUpdated: "2024-12-16T13:45:00Z",
    riskLevel: "medium",
    utilizationPercent: 63,
  },
];

// AU v1 Limits
const limits = {
  totalCap: 150000,
  lendingCap: 120000,
  paymentsPendingCap: 20000,
  highValueThreshold: 250000,
};

// Aggregate metrics
const aggregateMetrics = {
  totalCustomers: 4,
  totalExposure: 345000,
  avgUtilization: 57,
  highRiskCount: 1,
  mediumRiskCount: 1,
  lowRiskCount: 2,
  decisionsToday: 12,
  blockedToday: 2,
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskBadge(level: string) {
  switch (level) {
    case "high":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          High Risk
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500">
          <Activity className="h-3 w-3" />
          Medium
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-500">
          <Shield className="h-3 w-3" />
          Low Risk
        </Badge>
      );
  }
}

function getUtilizationColor(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-green-500";
}

export default function ExposureDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  const filteredCustomers = mockCustomerExposures.filter(
    (c) =>
      c.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exposure Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time exposure monitoring and limit management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Last sync: 2 min ago
          </Badge>
        </div>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exposure</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(aggregateMetrics.totalExposure)}</div>
            <p className="text-xs text-muted-foreground">
              Across {aggregateMetrics.totalCustomers} customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.avgUtilization}%</div>
            <Progress value={aggregateMetrics.avgUtilization} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm">{aggregateMetrics.highRiskCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-sm">{aggregateMetrics.mediumRiskCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm">{aggregateMetrics.lowRiskCount}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {aggregateMetrics.highRiskCount} customers near limits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decisions Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.decisionsToday}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-500">{aggregateMetrics.blockedToday} blocked</span> by exposure limits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AU v1 Limits Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            AU v1 Limits Configuration
          </CardTitle>
          <CardDescription>
            Active exposure limits for Australian jurisdiction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Exposure Cap</span>
                <span className="font-mono font-medium">{formatCurrency(limits.totalCap)}</span>
              </div>
              <Badge variant="outline" className="text-xs">LIMIT-AU-TOTAL-001</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lending Cap</span>
                <span className="font-mono font-medium">{formatCurrency(limits.lendingCap)}</span>
              </div>
              <Badge variant="outline" className="text-xs">LIMIT-AU-LENDING-001</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending Payments Cap</span>
                <span className="font-mono font-medium">{formatCurrency(limits.paymentsPendingCap)}</span>
              </div>
              <Badge variant="outline" className="text-xs">LIMIT-AU-PAYPEND-001</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">High Value Threshold</span>
                <span className="font-mono font-medium">{formatCurrency(limits.highValueThreshold)}</span>
              </div>
              <Badge variant="outline" className="text-xs">LIMIT-AU-HIGHVALUE-001</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Exposure Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Exposures</CardTitle>
              <CardDescription>
                Real-time exposure snapshots with limit utilization
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Total Exposure</TableHead>
                <TableHead>Breakdown</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Snapshot</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.customerId}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.customerName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {customer.customerId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono font-medium">
                      {formatCurrency(customer.totalExposure)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      of {formatCurrency(limits.totalCap)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <span>Lending: {formatCurrency(customer.lendingExposure)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <span>Pending: {formatCurrency(customer.paymentsPending)}</span>
                      </div>
                      {customer.holdsExposure > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>Holds: {formatCurrency(customer.holdsExposure)}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{customer.utilizationPercent}%</span>
                        {customer.utilizationPercent >= 80 && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getUtilizationColor(customer.utilizationPercent)}`}
                          style={{ width: `${customer.utilizationPercent}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRiskBadge(customer.riskLevel)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-mono">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        {customer.snapshotHash}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Event #{customer.asOfLedgerEvent}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/exposure/${customer.customerId}`}>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        View
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
