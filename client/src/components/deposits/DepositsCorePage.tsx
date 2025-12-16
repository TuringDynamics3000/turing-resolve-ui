/**
 * DepositsCorePage.tsx - Deposits Core v1 Integration UI
 * 
 * Shows accounts rebuilt from facts with governance flow visualization.
 * Demonstrates the immutable banking primitive in action.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Wallet,
  Lock,
  Clock,
  Plus,
  Eye,
  RefreshCw,
  FileText,
  Database,
  Layers,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Format currency - handles decimal strings like "1000.00" from the router
function formatCurrency(amount: string | number, currency: string = "AUD"): string {
  // The router returns formatted decimal strings like "1000.00", not cents
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(num);
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Account status badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    OPEN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    CLOSED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  
  return (
    <Badge variant="outline" className={config[status] || "bg-gray-500/20 text-gray-400"}>
      {status}
    </Badge>
  );
}

// Fact type badge
function FactTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    ACCOUNT_OPENED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: Plus },
    POSTING_APPLIED: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: ArrowRight },
    ACCOUNT_CLOSED: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Lock },
  };
  
  const { color, icon: Icon } = config[type] || { color: "bg-gray-500/20 text-gray-400", icon: FileText };
  
  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {type.replace("_", " ")}
    </Badge>
  );
}

// Posting type badge
function PostingTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; icon: typeof ArrowUpRight }> = {
    CREDIT: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: ArrowUpRight },
    DEBIT: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: ArrowDownRight },
    HOLD_PLACED: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Lock },
    HOLD_RELEASED: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle2 },
    INTEREST_ACCRUED: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: ArrowUpRight },
  };
  
  const { color, icon: Icon } = config[type] || { color: "bg-gray-500/20 text-gray-400", icon: FileText };
  
  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {type.replace("_", " ")}
    </Badge>
  );
}

// Create Account Dialog
function CreateAccountDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [productType, setProductType] = useState<"savings" | "checking" | "term_deposit">("savings");
  const [customerSegment, setCustomerSegment] = useState<"standard" | "premium" | "business" | "private">("standard");
  
  const createAccount = trpc.deposits.openAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Account ${data.accountId} created successfully`);
      setOpen(false);
      setCustomerId("");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleSubmit = () => {
    if (!customerId) {
      toast.error("Customer ID is required");
      return;
    }
    createAccount.mutate({
      customerId,
      productType,
      customerSegment,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Open Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Deposit Account</DialogTitle>
          <DialogDescription>
            Create a new deposit account using Deposits Core v1.
            All operations are fact-sourced and immutable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="customerId">Customer ID</Label>
            <Input
              id="customerId"
              placeholder="CUST-001"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productType">Product Type</Label>
            <Select value={productType} onValueChange={(v) => setProductType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="term_deposit">Term Deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerSegment">Customer Segment</Label>
            <Select value={customerSegment} onValueChange={(v) => setCustomerSegment(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={createAccount.isPending}
          >
            {createAccount.isPending ? "Creating..." : "Create Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Account Detail Dialog
function AccountDetailDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const { data: account, isLoading } = trpc.deposits.getAccount.useQuery(
    { accountId },
    { enabled: open }
  );
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Eye className="h-4 w-4" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Account {accountId}
          </DialogTitle>
          <DialogDescription>
            Account state rebuilt from immutable facts
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : account ? (
          <div className="space-y-6 pt-4">
            {/* State Summary */}
            {account.state && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">Ledger Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(account.state.ledgerBalance, account.state.currency)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(account.state.availableBalance, account.state.currency)}
                  </p>
                </div>
              </div>
            )}
            
            {/* Holds */}
            {account.state && account.state.holds.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Active Holds ({account.state.holds.length})
                </h4>
                <div className="space-y-2">
                  {account.state.holds.map((hold: any) => (
                    <div
                      key={hold.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <span className="font-mono text-sm">{hold.id}</span>
                      <span className="font-medium">
                        {formatCurrency(hold.amount.amount, hold.amount.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Facts Timeline */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Facts Timeline ({account.facts.length} facts)
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {account.facts.map((fact: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{fact.sequence || index + 1}
                      </span>
                      <FactTypeBadge type={fact.type} />
                      {fact.posting && (
                        <PostingTypeBadge type={fact.posting.type} />
                      )}
                    </div>
                    <div className="text-right">
                      {fact.posting?.amount && (
                        <span className="font-medium">
                          {formatCurrency(fact.posting.amount.amount, fact.posting.amount.currency)}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(fact.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Governance Guarantee */}
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="font-medium text-emerald-400">Immutable Audit Trail</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This account state is deterministically rebuilt from {account.facts.length} immutable facts.
                Replaying the same facts will always produce the same state.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Account not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Credit/Debit Dialog
function TransactionDialog({ accountId, type, onSuccess }: { accountId: string; type: "credit" | "debit"; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  
  const creditMutation = trpc.deposits.credit.useMutation({
    onSuccess: () => {
      toast.success(`Credit applied successfully`);
      setOpen(false);
      setAmount("");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const debitMutation = trpc.deposits.debit.useMutation({
    onSuccess: () => {
      toast.success(`Debit applied successfully`);
      setOpen(false);
      setAmount("");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (type === "credit") {
      creditMutation.mutate({ accountId, amount });
    } else {
      debitMutation.mutate({ accountId, amount });
    }
  };
  
  const isPending = creditMutation.isPending || debitMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={type === "credit" ? "text-emerald-400" : "text-red-400"}
        >
          {type === "credit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "credit" ? "Credit" : "Debit"} Account</DialogTitle>
          <DialogDescription>
            Apply a {type} posting to account {accountId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (AUD)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "Processing..." : `Apply ${type === "credit" ? "Credit" : "Debit"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export function DepositsCorePage() {
  const { data: accounts, isLoading, refetch } = trpc.deposits.listAccounts.useQuery();
  const { data: stats } = trpc.deposits.getStats.useQuery();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Deposits Core v1
          </h2>
          <p className="text-sm text-muted-foreground">
            Immutable banking primitive • Fact-sourced • Policy-agnostic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <CreateAccountDialog onSuccess={() => refetch()} />
        </div>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-panel">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-2xl font-bold">{stats.totalAccounts}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Open Accounts</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.openAccounts}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Ledger</p>
              <p className="text-2xl font-bold">{stats.totalLedgerBalance}</p>
            </CardContent>
          </Card>
          <Card className="glass-panel">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Active Holds</p>
              <p className="text-2xl font-bold text-amber-400">{stats.totalHolds}</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Accounts Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Fact-Sourced Accounts
          </CardTitle>
          <CardDescription>
            Accounts rebuilt from immutable facts using Deposits Core v1
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts && accounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ledger</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account: any) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-sm">{account.accountId || account.id}</TableCell>
                    <TableCell>{account.customerId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.productType}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={account.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {account.ledgerBalance ? formatCurrency(account.ledgerBalance, account.currency) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {account.availableBalance ? formatCurrency(account.availableBalance, account.currency) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <AccountDetailDialog accountId={account.accountId || account.id} />
                        <TransactionDialog
                          accountId={account.accountId || account.id}
                          type="credit"
                          onSuccess={() => refetch()}
                        />
                        <TransactionDialog
                          accountId={account.accountId || account.id}
                          type="debit"
                          onSuccess={() => refetch()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No accounts yet</p>
              <p className="text-sm">Create your first account to see it here</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Governance Info */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Core v1 Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-blue-400" />
                <h4 className="font-medium">Immutable Facts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                All state changes are recorded as immutable facts.
                No direct balance mutations allowed.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-emerald-400" />
                <h4 className="font-medium">Deterministic Replay</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Account state is rebuilt from facts on every read.
                Same facts = same state, always.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-amber-400" />
                <h4 className="font-medium">Frozen Invariants</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Balance rules enforced at the core.
                Policies recommend, core decides.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DepositsCorePage;
