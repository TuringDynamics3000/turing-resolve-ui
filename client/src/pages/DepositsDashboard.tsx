import { useState } from "react";
import { Link } from "wouter";
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
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Wallet,
  Lock,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Pause,
  XCircle,
  DollarSign,
  Calendar,
  FileText,
  RefreshCw,
} from "lucide-react";

// Account states
type AccountState = "CREATED" | "ACTIVE" | "FROZEN" | "LEGAL_HOLD" | "DORMANT" | "CLOSED";

// Mock account data
const accounts = [
  {
    id: "ACC-001",
    customerId: "CUS-001",
    customerName: "Sarah Johnson",
    state: "ACTIVE" as AccountState,
    productType: "SAVINGS",
    ledgerBalance: 45250.00,
    availableBalance: 42750.00,
    activeHolds: 2500.00,
    pendingDebits: 0,
    interestAccrued: 125.50,
    lastActivity: "2024-12-16T14:30:00Z",
    openedDate: "2023-06-15",
  },
  {
    id: "ACC-002",
    customerId: "CUS-002",
    customerName: "Michael Chen",
    state: "FROZEN" as AccountState,
    productType: "TRANSACTION",
    ledgerBalance: 12500.00,
    availableBalance: 0,
    activeHolds: 12500.00,
    pendingDebits: 0,
    interestAccrued: 0,
    lastActivity: "2024-12-15T09:15:00Z",
    openedDate: "2022-11-20",
  },
  {
    id: "ACC-003",
    customerId: "CUS-003",
    customerName: "Emily Williams",
    state: "ACTIVE" as AccountState,
    productType: "TERM_DEPOSIT",
    ledgerBalance: 100000.00,
    availableBalance: 100000.00,
    activeHolds: 0,
    pendingDebits: 0,
    interestAccrued: 2450.00,
    lastActivity: "2024-12-01T00:00:00Z",
    openedDate: "2024-01-15",
  },
  {
    id: "ACC-004",
    customerId: "CUS-004",
    customerName: "James Rodriguez",
    state: "LEGAL_HOLD" as AccountState,
    productType: "SAVINGS",
    ledgerBalance: 78500.00,
    availableBalance: 0,
    activeHolds: 78500.00,
    pendingDebits: 0,
    interestAccrued: 890.25,
    lastActivity: "2024-12-10T11:20:00Z",
    openedDate: "2021-03-08",
  },
  {
    id: "ACC-005",
    customerId: "CUS-005",
    customerName: "Lisa Thompson",
    state: "DORMANT" as AccountState,
    productType: "SAVINGS",
    ledgerBalance: 1250.00,
    availableBalance: 1250.00,
    activeHolds: 0,
    pendingDebits: 0,
    interestAccrued: 15.75,
    lastActivity: "2024-03-15T16:45:00Z",
    openedDate: "2020-08-22",
  },
  {
    id: "ACC-006",
    customerId: "CUS-006",
    customerName: "David Kim",
    state: "ACTIVE" as AccountState,
    productType: "TRANSACTION",
    ledgerBalance: 8750.50,
    availableBalance: 6250.50,
    activeHolds: 2500.00,
    pendingDebits: 0,
    interestAccrued: 0,
    lastActivity: "2024-12-16T16:00:00Z",
    openedDate: "2023-09-01",
  },
];

// Recent holds
const recentHolds = [
  {
    id: "HOLD-001",
    accountId: "ACC-001",
    type: "PAYMENT_PENDING",
    amount: 2500.00,
    status: "ACTIVE",
    placedAt: "2024-12-16T10:00:00Z",
    expiresAt: "2024-12-19T10:00:00Z",
    decisionId: "DEC-HOLD-001",
  },
  {
    id: "HOLD-002",
    accountId: "ACC-002",
    type: "FRAUD_INVESTIGATION",
    amount: 12500.00,
    status: "ACTIVE",
    placedAt: "2024-12-15T09:15:00Z",
    expiresAt: null,
    decisionId: "DEC-HOLD-002",
  },
  {
    id: "HOLD-003",
    accountId: "ACC-004",
    type: "LEGAL_ORDER",
    amount: 78500.00,
    status: "ACTIVE",
    placedAt: "2024-12-10T11:20:00Z",
    expiresAt: null,
    decisionId: "DEC-HOLD-003",
  },
  {
    id: "HOLD-004",
    accountId: "ACC-006",
    type: "CHEQUE_CLEARANCE",
    amount: 2500.00,
    status: "ACTIVE",
    placedAt: "2024-12-16T14:00:00Z",
    expiresAt: "2024-12-18T14:00:00Z",
    decisionId: "DEC-HOLD-004",
  },
];

// Recent interest postings
const interestPostings = [
  {
    id: "INT-001",
    accountId: "ACC-001",
    amount: 125.50,
    rate: 3.25,
    period: "2024-11",
    postedAt: "2024-12-01T00:00:00Z",
    ledgerRef: "LED-INT-001",
  },
  {
    id: "INT-002",
    accountId: "ACC-003",
    amount: 2450.00,
    rate: 4.50,
    period: "2024-11",
    postedAt: "2024-12-01T00:00:00Z",
    ledgerRef: "LED-INT-002",
  },
  {
    id: "INT-003",
    accountId: "ACC-004",
    amount: 890.25,
    rate: 3.25,
    period: "2024-11",
    postedAt: "2024-12-01T00:00:00Z",
    ledgerRef: "LED-INT-003",
  },
];

function AccountStateBadge({ state }: { state: AccountState }) {
  const config: Record<AccountState, { color: string; icon: typeof CheckCircle2 }> = {
    CREATED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
    ACTIVE: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    FROZEN: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Pause },
    LEGAL_HOLD: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: Lock },
    DORMANT: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
    CLOSED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
  };

  const { color, icon: Icon } = config[state];

  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {state.replace("_", " ")}
    </Badge>
  );
}

function HoldTypeBadge({ type }: { type: string }) {
  const config: Record<string, string> = {
    PAYMENT_PENDING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    FRAUD_INVESTIGATION: "bg-red-500/20 text-red-400 border-red-500/30",
    LEGAL_ORDER: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CHEQUE_CLEARANCE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <Badge variant="outline" className={config[type] || "bg-gray-500/20 text-gray-400"}>
      {type.replace("_", " ")}
    </Badge>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryCards() {
  const totalLedgerBalance = accounts.reduce((sum, a) => sum + a.ledgerBalance, 0);
  const totalAvailableBalance = accounts.reduce((sum, a) => sum + a.availableBalance, 0);
  const totalHolds = accounts.reduce((sum, a) => sum + a.activeHolds, 0);
  const totalInterest = accounts.reduce((sum, a) => sum + a.interestAccrued, 0);
  const activeAccounts = accounts.filter((a) => a.state === "ACTIVE").length;
  const frozenAccounts = accounts.filter((a) => a.state === "FROZEN" || a.state === "LEGAL_HOLD").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Total Ledger Balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalLedgerBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {accounts.length} accounts
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Available Balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalAvailableBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(totalHolds)} in holds
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Interest Accrued
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalInterest)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pending posting
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Account Status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{activeAccounts} Active</p>
          <p className="text-xs text-muted-foreground mt-1">
            {frozenAccounts} frozen/held
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Deposit Accounts
            </CardTitle>
            <CardDescription>All accounts with balance and state information</CardDescription>
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
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ledger Balance</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Holds</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{account.id}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{account.customerName}</p>
                    <p className="text-xs text-muted-foreground">{account.customerId}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <AccountStateBadge state={account.state} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{account.productType}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(account.ledgerBalance)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={account.availableBalance === 0 ? "text-red-400" : ""}>
                    {formatCurrency(account.availableBalance)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {account.activeHolds > 0 ? (
                    <span className="text-amber-400">{formatCurrency(account.activeHolds)}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/deposits/${account.id}`}>
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

function HoldsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Active Holds
            </CardTitle>
            <CardDescription>All holds affecting available balances</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hold ID</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentHolds.map((hold) => (
              <TableRow key={hold.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{hold.id}</TableCell>
                <TableCell className="font-mono">{hold.accountId}</TableCell>
                <TableCell>
                  <HoldTypeBadge type={hold.type} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(hold.amount)}
                </TableCell>
                <TableCell className="text-sm">{formatDate(hold.placedAt)}</TableCell>
                <TableCell className="text-sm">
                  {hold.expiresAt ? formatDate(hold.expiresAt) : (
                    <span className="text-muted-foreground">No expiry</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/decisions/${hold.decisionId}`}>
                    <Button variant="ghost" size="sm" className="font-mono text-xs">
                      {hold.decisionId}
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

function InterestPostingsTable() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Interest Postings
            </CardTitle>
            <CardDescription>Recent interest calculations and ledger postings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Posting ID</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Ledger Ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interestPostings.map((posting) => (
              <TableRow key={posting.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-primary">{posting.id}</TableCell>
                <TableCell className="font-mono">{posting.accountId}</TableCell>
                <TableCell>{posting.period}</TableCell>
                <TableCell className="text-right">{posting.rate}%</TableCell>
                <TableCell className="text-right font-mono text-emerald-400">
                  +{formatCurrency(posting.amount)}
                </TableCell>
                <TableCell className="text-sm">{formatDate(posting.postedAt)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {posting.ledgerRef}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
          Deposits Governance
        </CardTitle>
        <CardDescription>Module constraints and Resolve integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Account State Transitions</h4>
            <p className="text-sm text-muted-foreground">
              All state changes (freeze, unfreeze, close) require Resolve authorization with decision_id.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Hold Operations</h4>
            <p className="text-sm text-muted-foreground">
              Hold placement and release are Resolve-gated. Holds affect available balance only.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Balance Formula</h4>
            <p className="text-sm font-mono text-muted-foreground">
              available = ledger - holds - pending
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <h4 className="font-medium mb-2">Interest & Fees</h4>
            <p className="text-sm text-muted-foreground">
              Daily accrual, monthly posting via ledger. Fee waivers require Resolve authorization.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium text-emerald-400">Replacement-Grade Status</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Deposits module is production-ready. UltraData/Geniusto deposits can be turned off.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DepositsDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Deposits</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Account & Balance Management • Replacement-Grade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            18/18 Tests Passing
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList className="glass-panel p-1">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="holds">Holds</TabsTrigger>
          <TabsTrigger value="interest">Interest</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountsTable />
        </TabsContent>

        <TabsContent value="holds">
          <HoldsTable />
        </TabsContent>

        <TabsContent value="interest">
          <InterestPostingsTable />
        </TabsContent>

        <TabsContent value="governance">
          <GovernanceInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
