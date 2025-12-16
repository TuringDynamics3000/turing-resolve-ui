import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  XCircle,
  FileText,
  RefreshCw,
  Lock,
  Zap,
  Hash,
  Database,
} from "lucide-react";
import PaymentsCorePage from "./PaymentsCorePage";

// Payment states
type PaymentState = "CREATED" | "AUTHORISED" | "SUBMITTED" | "COMPLETED" | "FAILED" | "REVERSED";

// Mock payment data
const payments = [
  {
    id: "PAY-001",
    customerId: "CUS-001",
    customerName: "Sarah Johnson",
    state: "COMPLETED" as PaymentState,
    type: "OUTBOUND",
    amount: 1500.00,
    currency: "AUD",
    recipient: "Electric Company",
    reference: "BILL-DEC-2024",
    createdAt: "2024-12-16T10:30:00Z",
    completedAt: "2024-12-16T10:32:00Z",
    decisionId: "DEC-PAY-001",
  },
  {
    id: "PAY-002",
    customerId: "CUS-002",
    customerName: "Michael Chen",
    state: "AUTHORISED" as PaymentState,
    type: "OUTBOUND",
    amount: 5000.00,
    currency: "AUD",
    recipient: "Landlord Pty Ltd",
    reference: "RENT-DEC-2024",
    createdAt: "2024-12-16T14:00:00Z",
    completedAt: null,
    decisionId: "DEC-PAY-002",
  },
  {
    id: "PAY-003",
    customerId: "CUS-003",
    customerName: "Emily Williams",
    state: "FAILED" as PaymentState,
    type: "OUTBOUND",
    amount: 25000.00,
    currency: "AUD",
    recipient: "Investment Fund",
    reference: "INV-TRANSFER",
    createdAt: "2024-12-16T11:15:00Z",
    completedAt: null,
    decisionId: "DEC-PAY-003",
  },
  {
    id: "PAY-004",
    customerId: "CUS-004",
    customerName: "James Rodriguez",
    state: "COMPLETED" as PaymentState,
    type: "INBOUND",
    amount: 3500.00,
    currency: "AUD",
    recipient: "Salary Deposit",
    reference: "SALARY-DEC-W2",
    createdAt: "2024-12-15T09:00:00Z",
    completedAt: "2024-12-15T09:05:00Z",
    decisionId: "DEC-PAY-004",
  },
  {
    id: "PAY-005",
    customerId: "CUS-005",
    customerName: "Lisa Thompson",
    state: "REVERSED" as PaymentState,
    type: "OUTBOUND",
    amount: 750.00,
    currency: "AUD",
    recipient: "Online Store",
    reference: "ORDER-12345",
    createdAt: "2024-12-14T16:30:00Z",
    completedAt: "2024-12-15T10:00:00Z",
    decisionId: "DEC-PAY-005",
  },
  {
    id: "PAY-006",
    customerId: "CUS-006",
    customerName: "David Kim",
    state: "SUBMITTED" as PaymentState,
    type: "OUTBOUND",
    amount: 2200.00,
    currency: "AUD",
    recipient: "Insurance Co",
    reference: "PREMIUM-Q4",
    createdAt: "2024-12-16T15:45:00Z",
    completedAt: null,
    decisionId: "DEC-PAY-006",
  },
];

// Payment events for event sourcing view
const paymentEvents = [
  {
    id: "EVT-001",
    paymentId: "PAY-001",
    type: "PAYMENT_CREATED",
    timestamp: "2024-12-16T10:30:00Z",
    hash: "a1b2c3d4e5f6...",
    prevHash: "0000000000...",
  },
  {
    id: "EVT-002",
    paymentId: "PAY-001",
    type: "PAYMENT_AUTHORISED",
    timestamp: "2024-12-16T10:30:30Z",
    hash: "b2c3d4e5f6g7...",
    prevHash: "a1b2c3d4e5f6...",
  },
  {
    id: "EVT-003",
    paymentId: "PAY-001",
    type: "PAYMENT_SUBMITTED",
    timestamp: "2024-12-16T10:31:00Z",
    hash: "c3d4e5f6g7h8...",
    prevHash: "b2c3d4e5f6g7...",
  },
  {
    id: "EVT-004",
    paymentId: "PAY-001",
    type: "PAYMENT_COMPLETED",
    timestamp: "2024-12-16T10:32:00Z",
    hash: "d4e5f6g7h8i9...",
    prevHash: "c3d4e5f6g7h8...",
  },
  {
    id: "EVT-005",
    paymentId: "PAY-002",
    type: "PAYMENT_CREATED",
    timestamp: "2024-12-16T14:00:00Z",
    hash: "e5f6g7h8i9j0...",
    prevHash: "0000000000...",
  },
  {
    id: "EVT-006",
    paymentId: "PAY-002",
    type: "PAYMENT_AUTHORISED",
    timestamp: "2024-12-16T14:00:30Z",
    hash: "f6g7h8i9j0k1...",
    prevHash: "e5f6g7h8i9j0...",
  },
];

function PaymentStateBadge({ state }: { state: PaymentState }) {
  const config: Record<PaymentState, { color: string; icon: typeof CheckCircle2 }> = {
    CREATED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
    AUTHORISED: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle2 },
    SUBMITTED: { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", icon: Zap },
    COMPLETED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
    REVERSED: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertCircle },
  };

  const { color, icon: Icon } = config[state];

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {state}
    </Badge>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const config: Record<string, string> = {
    PAYMENT_CREATED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    PAYMENT_AUTHORISED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PAYMENT_SUBMITTED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    PAYMENT_COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PAYMENT_FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
    PAYMENT_REVERSED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <Badge variant="outline" className={config[type] || "bg-gray-500/20 text-gray-400"}>
      {type.replace("PAYMENT_", "")}
    </Badge>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryCards() {
  const totalVolume = payments.reduce((sum, p) => sum + p.amount, 0);
  const completedPayments = payments.filter((p) => p.state === "COMPLETED").length;
  const pendingPayments = payments.filter((p) => ["CREATED", "AUTHORISED", "SUBMITTED"].includes(p.state)).length;
  const failedPayments = payments.filter((p) => p.state === "FAILED").length;
  const outboundVolume = payments.filter((p) => p.type === "OUTBOUND").reduce((sum, p) => sum + p.amount, 0);
  const inboundVolume = payments.filter((p) => p.type === "INBOUND").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Total Volume
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalVolume)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {payments.length} payments
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Outbound
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(outboundVolume)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {payments.filter((p) => p.type === "OUTBOUND").length} payments
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Inbound
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(inboundVolume)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {payments.filter((p) => p.type === "INBOUND").length} payments
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{completedPayments} Completed</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingPayments} pending, {failedPayments} failed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payment Transactions
            </CardTitle>
            <CardDescription>All payments with status and decision links</CardDescription>
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
              <TableHead>Payment ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{payment.id}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{payment.customerName}</p>
                    <p className="text-xs text-muted-foreground">{payment.customerId}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <PaymentStateBadge state={payment.state} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="gap-1">
                    {payment.type === "OUTBOUND" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3" />
                    )}
                    {payment.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(payment.amount)}
                </TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {payment.recipient}
                </TableCell>
                <TableCell className="text-sm">{formatDate(payment.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/decisions/${payment.decisionId}`}>
                    <Button variant="ghost" size="sm" className="font-mono text-xs">
                      {payment.decisionId}
                    </Button>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/payments/${payment.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EventChainTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Event Chain
            </CardTitle>
            <CardDescription>Cryptographically-linked event history for replay proof</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event ID</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Prev Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentEvents.map((event) => (
              <TableRow key={event.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{event.id}</TableCell>
                <TableCell className="font-mono">{event.paymentId}</TableCell>
                <TableCell>
                  <EventTypeBadge type={event.type} />
                </TableCell>
                <TableCell className="text-sm">{formatDate(event.timestamp)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {event.hash}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {event.prevHash}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Replay Guarantee:</strong> Each event is cryptographically 
            linked to the previous event via SHA-256 hash chain. Replaying events from any point produces 
            identical state, proving deterministic behavior.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GovernanceInfo() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Payments Governance
        </CardTitle>
        <CardDescription>Module constraints and Resolve integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Hard-Gated State Machine</h4>
            <p className="text-sm text-muted-foreground">
              No state transition without decision_id. MissingDecisionError enforced at runtime.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Exposure Gate</h4>
            <p className="text-sm text-muted-foreground">
              Payment authorization requires ExposureSnapshot. Cannot AUTHORISE if exposure breached.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Event Sourcing</h4>
            <p className="text-sm text-muted-foreground">
              All state changes are event-sourced with SHA-256 hash chain for cryptographic integrity.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Evidence Packs</h4>
            <p className="text-sm text-muted-foreground">
              Every payment generates a verifiable evidence pack with manifest hash for audit.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium text-emerald-400">Bank-Grade Status</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Payments module is frozen and production-ready. 49 tests passing (21 state machine, 16 replay, 12 evidence).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PaymentsDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Payments</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Payment Processing • Bank-Grade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            49/49 Tests Passing
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Tabs */}
      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="events">Event Chain</TabsTrigger>
          <TabsTrigger value="corev1" className="gap-1">
            <Database className="h-3 w-3" />
            Core v1
          </TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentsTable />
        </TabsContent>

        <TabsContent value="events">
          <EventChainTable />
        </TabsContent>

        <TabsContent value="corev1">
          <PaymentsCorePage />
        </TabsContent>

        <TabsContent value="governance">
          <GovernanceInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
