import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Building2,
  CreditCard
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type PaymentScheme = "NPP" | "BECS" | "INTERNAL";
type PaymentStatus = "INITIATED" | "VALIDATED" | "AUTHORIZED" | "SUBMITTED" | "SETTLED" | "FAILED" | "RETURNED";
type PaymentPriority = "IMMEDIATE" | "SAME_DAY" | "NEXT_DAY";

interface Payment {
  paymentId: string;
  scheme: PaymentScheme;
  status: PaymentStatus;
  priority: PaymentPriority;
  amount: number;
  currency: string;
  debtor: { name: string; bsb: string; accountNumber: string };
  creditor: { name: string; bsb: string; accountNumber: string };
  reference: string;
  createdAt: string;
  settledAt?: string;
}

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_PAYMENTS: Payment[] = [
  {
    paymentId: "PAY-001",
    scheme: "NPP",
    status: "SETTLED",
    priority: "IMMEDIATE",
    amount: 1500.00,
    currency: "AUD",
    debtor: { name: "TuringDynamics Pty Ltd", bsb: "062-000", accountNumber: "12345678" },
    creditor: { name: "Supplier Co", bsb: "063-001", accountNumber: "87654321" },
    reference: "INV-2024-001",
    createdAt: "2024-12-18T09:30:00Z",
    settledAt: "2024-12-18T09:30:05Z",
  },
  {
    paymentId: "PAY-002",
    scheme: "BECS",
    status: "SUBMITTED",
    priority: "NEXT_DAY",
    amount: 25000.00,
    currency: "AUD",
    debtor: { name: "TuringDynamics Pty Ltd", bsb: "062-000", accountNumber: "12345678" },
    creditor: { name: "Payroll Services", bsb: "064-002", accountNumber: "11223344" },
    reference: "PAYROLL-DEC-W2",
    createdAt: "2024-12-18T08:00:00Z",
  },
  {
    paymentId: "PAY-003",
    scheme: "NPP",
    status: "FAILED",
    priority: "IMMEDIATE",
    amount: 500.00,
    currency: "AUD",
    debtor: { name: "TuringDynamics Pty Ltd", bsb: "062-000", accountNumber: "12345678" },
    creditor: { name: "Unknown Recipient", bsb: "999-999", accountNumber: "00000000" },
    reference: "TEST-FAIL",
    createdAt: "2024-12-18T07:15:00Z",
  },
  {
    paymentId: "PAY-004",
    scheme: "INTERNAL",
    status: "SETTLED",
    priority: "IMMEDIATE",
    amount: 10000.00,
    currency: "AUD",
    debtor: { name: "Operating Account", bsb: "062-000", accountNumber: "12345678" },
    creditor: { name: "Savings Account", bsb: "062-000", accountNumber: "87654321" },
    reference: "INTERNAL-TRANSFER",
    createdAt: "2024-12-18T06:00:00Z",
    settledAt: "2024-12-18T06:00:01Z",
  },
];

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { color: string; icon: React.ReactNode }> = {
    INITIATED: { color: "bg-slate-500/20 text-slate-400", icon: <Clock className="w-3 h-3" /> },
    VALIDATED: { color: "bg-blue-500/20 text-blue-400", icon: <CheckCircle className="w-3 h-3" /> },
    AUTHORIZED: { color: "bg-purple-500/20 text-purple-400", icon: <CheckCircle className="w-3 h-3" /> },
    SUBMITTED: { color: "bg-amber-500/20 text-amber-400", icon: <Clock className="w-3 h-3" /> },
    SETTLED: { color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle className="w-3 h-3" /> },
    FAILED: { color: "bg-red-500/20 text-red-400", icon: <XCircle className="w-3 h-3" /> },
    RETURNED: { color: "bg-orange-500/20 text-orange-400", icon: <AlertCircle className="w-3 h-3" /> },
  };

  const { color, icon } = config[status];

  return (
    <Badge className={`${color} gap-1 font-medium`}>
      {icon}
      {status}
    </Badge>
  );
}

function SchemeBadge({ scheme }: { scheme: PaymentScheme }) {
  const config: Record<PaymentScheme, { color: string; icon: React.ReactNode; label: string }> = {
    NPP: { color: "bg-cyan-500/20 text-cyan-400", icon: <Zap className="w-3 h-3" />, label: "NPP" },
    BECS: { color: "bg-indigo-500/20 text-indigo-400", icon: <Building2 className="w-3 h-3" />, label: "BECS" },
    INTERNAL: { color: "bg-slate-500/20 text-slate-400", icon: <CreditCard className="w-3 h-3" />, label: "Internal" },
  };

  const { color, icon, label } = config[scheme];

  return (
    <Badge className={`${color} gap-1 font-medium`}>
      {icon}
      {label}
    </Badge>
  );
}

function PaymentForm({ onSubmit }: { onSubmit: (data: unknown) => void }) {
  const [scheme, setScheme] = useState<PaymentScheme>("NPP");
  const [priority, setPriority] = useState<PaymentPriority>("IMMEDIATE");
  const [amount, setAmount] = useState("");
  const [creditorName, setCreditorName] = useState("");
  const [creditorBsb, setCreditorBsb] = useState("");
  const [creditorAccount, setCreditorAccount] = useState("");
  const [reference, setReference] = useState("");
  
  // PayID lookup state
  const [payIdMode, setPayIdMode] = useState(false);
  const [payIdValue, setPayIdValue] = useState("");
  const [payIdLooking, setPayIdLooking] = useState(false);
  const [payIdResolved, setPayIdResolved] = useState<{ name: string; bsb: string; account: string } | null>(null);
  const [payIdError, setPayIdError] = useState<string | null>(null);

  const handlePayIdLookup = async () => {
    if (!payIdValue.trim()) return;
    
    setPayIdLooking(true);
    setPayIdError(null);
    setPayIdResolved(null);
    
    // Simulate PayID lookup (in production, this would call the backend)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulated PayID directory
    const payIds: Record<string, { name: string; bsb: string; account: string }> = {
      "john.smith@example.com": { name: "JOHN SMITH", bsb: "062-000", account: "12345678" },
      "jane.doe@company.com.au": { name: "JANE DOE", bsb: "063-001", account: "87654321" },
      "accounts@supplier.com.au": { name: "SUPPLIER PTY LTD", bsb: "064-002", account: "11223344" },
      "+61412345678": { name: "MOBILE USER", bsb: "062-000", account: "99887766" },
      "12345678901": { name: "ACME CORPORATION PTY LTD", bsb: "064-002", account: "12121212" },
    };
    
    const normalized = payIdValue.toLowerCase().trim();
    const result = payIds[normalized];
    
    if (result) {
      setPayIdResolved(result);
      setCreditorName(result.name);
      setCreditorBsb(result.bsb);
      setCreditorAccount(result.account);
      toast.success("PayID Verified", { description: `Found: ${result.name}` });
    } else {
      setPayIdError("PayID not found. Please check and try again.");
    }
    
    setPayIdLooking(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      scheme,
      priority,
      amount: parseFloat(amount),
      creditor: {
        name: creditorName,
        bsb: creditorBsb,
        accountNumber: creditorAccount,
      },
      reference,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Payment Scheme</Label>
          <Select value={scheme} onValueChange={(v) => setScheme(v as PaymentScheme)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NPP">NPP (Instant)</SelectItem>
              <SelectItem value="BECS">BECS (Batch)</SelectItem>
              <SelectItem value="INTERNAL">Internal Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as PaymentPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMMEDIATE">Immediate</SelectItem>
              <SelectItem value="SAME_DAY">Same Day</SelectItem>
              <SelectItem value="NEXT_DAY">Next Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Amount (AUD)</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-300">Recipient Details</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPayIdMode(!payIdMode);
              setPayIdResolved(null);
              setPayIdError(null);
            }}
            className="text-cyan-400 hover:text-cyan-300"
          >
            {payIdMode ? "Enter BSB/Account" : "Use PayID"}
          </Button>
        </div>
        
        {payIdMode ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>PayID (Email, Phone, or ABN)</Label>
              <div className="flex gap-2">
                <Input
                  value={payIdValue}
                  onChange={(e) => {
                    setPayIdValue(e.target.value);
                    setPayIdResolved(null);
                    setPayIdError(null);
                  }}
                  placeholder="email@example.com or +61412345678"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handlePayIdLookup}
                  disabled={payIdLooking || !payIdValue.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {payIdLooking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {payIdError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle className="w-4 h-4" />
                {payIdError}
              </div>
            )}
            
            {payIdResolved && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                  <CheckCircle className="w-4 h-4" />
                  PayID Verified
                </div>
                <p className="font-medium text-slate-200">{payIdResolved.name}</p>
                <p className="text-sm text-slate-400 font-mono">
                  BSB: {payIdResolved.bsb} | Acc: {payIdResolved.account}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={creditorName}
                onChange={(e) => setCreditorName(e.target.value)}
                placeholder="Recipient name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>BSB</Label>
                <Input
                  value={creditorBsb}
                  onChange={(e) => setCreditorBsb(e.target.value)}
                  placeholder="000-000"
                  pattern="\d{3}-?\d{3}"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={creditorAccount}
                  onChange={(e) => setCreditorAccount(e.target.value)}
                  placeholder="12345678"
                  required
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label>Reference</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Payment reference"
          maxLength={18}
          required
        />
      </div>

      <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700">
        <Send className="w-4 h-4 mr-2" />
        Initiate Payment
      </Button>
    </form>
  );
}

function PaymentRow({ payment, onClick }: { payment: Payment; onClick: () => void }) {
  const isOutgoing = true; // All payments in this view are outgoing

  return (
    <tr 
      className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOutgoing ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
            {isOutgoing ? (
              <ArrowUpRight className="w-4 h-4 text-red-400" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-200">{payment.creditor.name}</p>
            <p className="text-xs text-slate-500">{payment.paymentId}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <SchemeBadge scheme={payment.scheme} />
      </td>
      <td className="py-4 px-4">
        <StatusBadge status={payment.status} />
      </td>
      <td className="py-4 px-4 text-right">
        <span className="font-mono font-medium text-slate-200">
          ${payment.amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
        </span>
      </td>
      <td className="py-4 px-4 text-slate-400 text-sm">
        {payment.reference}
      </td>
      <td className="py-4 px-4 text-slate-500 text-sm">
        {new Date(payment.createdAt).toLocaleString("en-AU", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
    </tr>
  );
}

function PaymentDetails({ payment }: { payment: Payment }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Payment ID</p>
          <p className="font-mono text-lg">{payment.paymentId}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Amount</p>
          <p className="text-2xl font-bold text-slate-100">
            ${payment.amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-slate-500">{payment.currency}</p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Scheme</p>
          <div className="flex items-center gap-2 mt-2">
            <SchemeBadge scheme={payment.scheme} />
            <Badge variant="outline" className="text-slate-400">
              {payment.priority}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-2">From</p>
          <p className="font-medium">{payment.debtor.name}</p>
          <p className="text-sm text-slate-400 font-mono">
            BSB: {payment.debtor.bsb} | Acc: {payment.debtor.accountNumber}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-2">To</p>
          <p className="font-medium">{payment.creditor.name}</p>
          <p className="text-sm text-slate-400 font-mono">
            BSB: {payment.creditor.bsb} | Acc: {payment.creditor.accountNumber}
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg">
        <p className="text-sm text-slate-500 mb-1">Reference</p>
        <p className="font-mono">{payment.reference}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Created</p>
          <p className="text-slate-300">
            {new Date(payment.createdAt).toLocaleString("en-AU")}
          </p>
        </div>
        {payment.settledAt && (
          <div>
            <p className="text-slate-500">Settled</p>
            <p className="text-slate-300">
              {new Date(payment.settledAt).toLocaleString("en-AU")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function PaymentsPage() {
  
  const [payments] = useState<Payment[]>(SAMPLE_PAYMENTS);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = 
      p.paymentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.creditor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleNewPayment = (data: unknown) => {
    toast.success("Payment Initiated", {
      description: "Your payment has been submitted for processing.",
    });
    console.log("New payment:", data);
  };

  // Stats
  const totalSettled = payments.filter(p => p.status === "SETTLED").reduce((sum, p) => sum + p.amount, 0);
  const pendingCount = payments.filter(p => ["INITIATED", "VALIDATED", "AUTHORIZED", "SUBMITTED"].includes(p.status)).length;
  const failedCount = payments.filter(p => p.status === "FAILED" || p.status === "RETURNED").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Payments</h1>
            <p className="text-slate-500">Initiate and track payment transactions</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Send className="w-4 h-4 mr-2" />
                New Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle>Initiate Payment</DialogTitle>
                <DialogDescription>
                  Create a new payment transaction
                </DialogDescription>
              </DialogHeader>
              <PaymentForm onSubmit={handleNewPayment} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Settled Today</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${totalSettled.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Failed / Returned</p>
              <p className="text-2xl font-bold text-red-400">{failedCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-200">{payments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Payments</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search payments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64 bg-slate-800 border-slate-700"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="SETTLED">Settled</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" className="border-slate-700">
                  <RefreshCw className="w-4 h-4" />
                </Button>

                <Button variant="outline" size="icon" className="border-slate-700">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-sm text-slate-500">
                    <th className="py-3 px-4 font-medium">Recipient</th>
                    <th className="py-3 px-4 font-medium">Scheme</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <PaymentRow
                      key={payment.paymentId}
                      payment={payment}
                      onClick={() => setSelectedPayment(payment)}
                    />
                  ))}
                </tbody>
              </table>

              {filteredPayments.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No payments found matching your criteria
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
            </DialogHeader>
            {selectedPayment && <PaymentDetails payment={selectedPayment} />}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
