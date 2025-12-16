import { useState } from "react";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Calendar,
  Shield,
  Building2,
  CreditCard,
  Hash,
  Play,
  Pause,
  ChevronRight,
  FileJson,
  FileBadge,
  TrendingUp,
  TrendingDown,
  Scale,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ============================================
// MOCK DATA - Statements
// ============================================

interface Statement {
  statementId: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  period: string;
  status: "pending" | "generated" | "delivered" | "failed";
  generatedAt: Date | null;
  hash: string | null;
  pages: number;
}

const MOCK_STATEMENTS: Statement[] = [
  {
    statementId: "STMT-2024-001",
    customerId: "CUST-001",
    customerName: "Sarah Johnson",
    accountNumber: "1234-5678-9012",
    period: "November 2024",
    status: "delivered",
    generatedAt: new Date("2024-12-01T10:30:00"),
    hash: "sha256:a1b2c3d4e5f6789012345678901234567890abcdef",
    pages: 4,
  },
  {
    statementId: "STMT-2024-002",
    customerId: "CUST-002",
    customerName: "Michael Chen",
    accountNumber: "2345-6789-0123",
    period: "November 2024",
    status: "generated",
    generatedAt: new Date("2024-12-01T11:15:00"),
    hash: "sha256:b2c3d4e5f6789012345678901234567890abcdef01",
    pages: 3,
  },
  {
    statementId: "STMT-2024-003",
    customerId: "CUST-003",
    customerName: "Emma Wilson",
    accountNumber: "3456-7890-1234",
    period: "November 2024",
    status: "pending",
    generatedAt: null,
    hash: null,
    pages: 0,
  },
  {
    statementId: "STMT-2024-004",
    customerId: "CUST-004",
    customerName: "James Brown",
    accountNumber: "4567-8901-2345",
    period: "November 2024",
    status: "failed",
    generatedAt: null,
    hash: null,
    pages: 0,
  },
  {
    statementId: "STMT-2024-005",
    customerId: "CUST-005",
    customerName: "Olivia Taylor",
    accountNumber: "5678-9012-3456",
    period: "November 2024",
    status: "delivered",
    generatedAt: new Date("2024-12-01T09:45:00"),
    hash: "sha256:c3d4e5f6789012345678901234567890abcdef0123",
    pages: 5,
  },
];

// ============================================
// MOCK DATA - Trial Balance
// ============================================

interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  debit: number;
  credit: number;
}

const MOCK_TRIAL_BALANCE: TrialBalanceAccount[] = [
  { accountCode: "1000", accountName: "Cash and Cash Equivalents", accountType: "asset", debit: 2450000, credit: 0 },
  { accountCode: "1100", accountName: "Loans Receivable", accountType: "asset", debit: 15780000, credit: 0 },
  { accountCode: "1200", accountName: "Interest Receivable", accountType: "asset", debit: 125000, credit: 0 },
  { accountCode: "1300", accountName: "Deposits with Banks", accountType: "asset", debit: 890000, credit: 0 },
  { accountCode: "2000", accountName: "Customer Deposits", accountType: "liability", debit: 0, credit: 14500000 },
  { accountCode: "2100", accountName: "Interest Payable", accountType: "liability", debit: 0, credit: 85000 },
  { accountCode: "2200", accountName: "Accounts Payable", accountType: "liability", debit: 0, credit: 320000 },
  { accountCode: "3000", accountName: "Share Capital", accountType: "equity", debit: 0, credit: 3000000 },
  { accountCode: "3100", accountName: "Retained Earnings", accountType: "equity", debit: 0, credit: 890000 },
  { accountCode: "4000", accountName: "Interest Income", accountType: "revenue", debit: 0, credit: 650000 },
  { accountCode: "4100", accountName: "Fee Income", accountType: "revenue", debit: 0, credit: 120000 },
  { accountCode: "5000", accountName: "Interest Expense", accountType: "expense", debit: 180000, credit: 0 },
  { accountCode: "5100", accountName: "Operating Expenses", accountType: "expense", debit: 140000, credit: 0 },
];

// ============================================
// MOCK DATA - Regulatory Reports
// ============================================

interface RegulatoryReport {
  reportId: string;
  reportName: string;
  regulator: "AML" | "APRA" | "ASIC";
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  nextRun: Date;
  lastRun: Date | null;
  lastStatus: "success" | "failed" | "pending" | null;
  lastHash: string | null;
  enabled: boolean;
}

const MOCK_REGULATORY_REPORTS: RegulatoryReport[] = [
  {
    reportId: "REG-AML-001",
    reportName: "AML Transaction Report",
    regulator: "AML",
    frequency: "daily",
    nextRun: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    lastRun: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
    lastStatus: "success",
    lastHash: "sha256:aml123456789abcdef",
    enabled: true,
  },
  {
    reportId: "REG-AML-002",
    reportName: "Suspicious Activity Report",
    regulator: "AML",
    frequency: "weekly",
    nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    lastRun: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    lastStatus: "success",
    lastHash: "sha256:sar987654321fedcba",
    enabled: true,
  },
  {
    reportId: "REG-APRA-001",
    reportName: "APRA Capital Adequacy Report",
    regulator: "APRA",
    frequency: "monthly",
    nextRun: new Date("2025-01-15T00:00:00"),
    lastRun: new Date("2024-12-15T00:00:00"),
    lastStatus: "success",
    lastHash: "sha256:apra456789abcdef012",
    enabled: true,
  },
  {
    reportId: "REG-APRA-002",
    reportName: "APRA Liquidity Coverage Ratio",
    regulator: "APRA",
    frequency: "monthly",
    nextRun: new Date("2025-01-15T00:00:00"),
    lastRun: new Date("2024-12-15T00:00:00"),
    lastStatus: "success",
    lastHash: "sha256:lcr789abcdef012345",
    enabled: true,
  },
  {
    reportId: "REG-ASIC-001",
    reportName: "ASIC Credit Activity Report",
    regulator: "ASIC",
    frequency: "quarterly",
    nextRun: new Date("2025-03-31T00:00:00"),
    lastRun: new Date("2024-12-31T00:00:00"),
    lastStatus: "pending",
    lastHash: null,
    enabled: true,
  },
  {
    reportId: "REG-ASIC-002",
    reportName: "ASIC Responsible Lending Report",
    regulator: "ASIC",
    frequency: "quarterly",
    nextRun: new Date("2025-03-31T00:00:00"),
    lastRun: new Date("2024-09-30T00:00:00"),
    lastStatus: "success",
    lastHash: "sha256:asic012345678abcdef",
    enabled: true,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimeUntil(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) return "Overdue";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m`;
}

function getStatusBadge(status: Statement["status"]) {
  switch (status) {
    case "delivered":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Delivered</Badge>;
    case "generated":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Generated</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
  }
}

function getRegulatorBadge(regulator: RegulatoryReport["regulator"]) {
  switch (regulator) {
    case "AML":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">AML</Badge>;
    case "APRA":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">APRA</Badge>;
    case "ASIC":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">ASIC</Badge>;
  }
}

// ============================================
// COMPONENTS
// ============================================

function StatementGenerationSection() {
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer to generate a statement.");
      return;
    }
    
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success("Statement has been added to the generation queue.");
    }, 1500);
  };

  const pendingCount = MOCK_STATEMENTS.filter(s => s.status === "pending").length;
  const generatedCount = MOCK_STATEMENTS.filter(s => s.status === "generated" || s.status === "delivered").length;
  const failedCount = MOCK_STATEMENTS.filter(s => s.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Statements</p>
                <p className="text-2xl font-bold text-white">{MOCK_STATEMENTS.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Generated</p>
                <p className="text-2xl font-bold text-green-400">{generatedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Failed</p>
                <p className="text-2xl font-bold text-red-400">{failedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Statement */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Generate Statement
          </CardTitle>
          <CardDescription>Generate a new customer statement on demand</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-[300px] bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_STATEMENTS.map(s => (
                  <SelectItem key={s.customerId} value={s.customerId}>
                    {s.customerName} - {s.accountNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Statement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statement History */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Statement History</CardTitle>
          <CardDescription>Recent statement generation activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_STATEMENTS.map(statement => (
              <div 
                key={statement.statementId}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-slate-700/50">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{statement.customerName}</p>
                    <p className="text-sm text-slate-400">{statement.accountNumber} • {statement.period}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {getStatusBadge(statement.status)}
                  
                  {statement.hash && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                            <Hash className="h-3 w-3" />
                            {statement.hash.slice(7, 15)}...
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">{statement.hash}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {statement.generatedAt && (
                    <span className="text-xs text-slate-500">
                      {formatDate(statement.generatedAt)}
                    </span>
                  )}
                  
                  {(statement.status === "generated" || statement.status === "delivered") && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-8 px-2">
                        <FileBadge className="h-4 w-4 text-red-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2">
                        <FileJson className="h-4 w-4 text-blue-400" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TrialBalanceSection() {
  const totalDebits = MOCK_TRIAL_BALANCE.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredits = MOCK_TRIAL_BALANCE.reduce((sum, acc) => sum + acc.credit, 0);
  const isBalanced = totalDebits === totalCredits;
  const variance = Math.abs(totalDebits - totalCredits);

  const assetTotal = MOCK_TRIAL_BALANCE.filter(a => a.accountType === "asset").reduce((sum, a) => sum + a.debit, 0);
  const liabilityTotal = MOCK_TRIAL_BALANCE.filter(a => a.accountType === "liability").reduce((sum, a) => sum + a.credit, 0);
  const equityTotal = MOCK_TRIAL_BALANCE.filter(a => a.accountType === "equity").reduce((sum, a) => sum + a.credit, 0);
  const revenueTotal = MOCK_TRIAL_BALANCE.filter(a => a.accountType === "revenue").reduce((sum, a) => sum + a.credit, 0);
  const expenseTotal = MOCK_TRIAL_BALANCE.filter(a => a.accountType === "expense").reduce((sum, a) => sum + a.debit, 0);

  return (
    <div className="space-y-6">
      {/* Balance Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`glass-panel border-2 ${isBalanced ? 'border-green-500/50' : 'border-red-500/50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale className={`h-6 w-6 ${isBalanced ? 'text-green-400' : 'text-red-400'}`} />
                <span className="text-lg font-semibold text-white">Balance Status</span>
              </div>
              {isBalanced ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">BALANCED</Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">UNBALANCED</Badge>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Debits</span>
                <span className="text-white font-mono">{formatCurrency(totalDebits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Credits</span>
                <span className="text-white font-mono">{formatCurrency(totalCredits)}</span>
              </div>
              {!isBalanced && (
                <div className="flex justify-between pt-2 border-t border-slate-700">
                  <span className="text-red-400">Variance</span>
                  <span className="text-red-400 font-mono">{formatCurrency(variance)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-6 w-6 text-blue-400" />
              <span className="text-lg font-semibold text-white">Last Reconciliation</span>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">Dec 16, 2024</p>
              <p className="text-sm text-slate-400">08:00 AM AEDT</p>
              <div className="flex items-center gap-2 mt-4">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400">All accounts reconciled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-6 w-6 text-purple-400" />
              <span className="text-lg font-semibold text-white">Trial Balance Hash</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-400 break-all">
                sha256:tb2024121608000012345678901234567890abcdef
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Deterministic hash of all account balances
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-2">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Why it matters
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The hash proves the trial balance hasn't been tampered with. Regenerating from the same ledger state will produce the identical hash.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Type Summary */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Balance by Account Type</CardTitle>
          <CardDescription>Summary of balances grouped by account classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-400">Assets</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(assetTotal)}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400">Liabilities</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(liabilityTotal)}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-400">Equity</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(equityTotal)}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400">Revenue</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(revenueTotal)}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-orange-400" />
                <span className="text-sm text-orange-400">Expenses</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(expenseTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Trial Balance */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Detailed Trial Balance</CardTitle>
          <CardDescription>All accounts with debit and credit balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Account Code</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Account Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Debit</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Credit</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRIAL_BALANCE.map(account => (
                  <tr key={account.accountCode} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-sm text-white">{account.accountCode}</td>
                    <td className="py-3 px-4 text-sm text-white">{account.accountName}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="capitalize text-xs">
                        {account.accountType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-white">
                      {account.debit > 0 ? formatCurrency(account.debit) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-white">
                      {account.credit > 0 ? formatCurrency(account.credit) : "-"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-800/50 font-bold">
                  <td colSpan={3} className="py-3 px-4 text-white">TOTAL</td>
                  <td className="py-3 px-4 text-right font-mono text-white">{formatCurrency(totalDebits)}</td>
                  <td className="py-3 px-4 text-right font-mono text-white">{formatCurrency(totalCredits)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RegulatoryReportsSection() {
  

  const handleRunNow = (report: RegulatoryReport) => {
    toast.success(`${report.reportName} has been added to the generation queue.`);
  };

  const handleToggle = (report: RegulatoryReport) => {
    toast.success(`${report.reportName} schedule has been ${report.enabled ? "disabled" : "enabled"}.`);
  };

  const amlReports = MOCK_REGULATORY_REPORTS.filter(r => r.regulator === "AML");
  const apraReports = MOCK_REGULATORY_REPORTS.filter(r => r.regulator === "APRA");
  const asicReports = MOCK_REGULATORY_REPORTS.filter(r => r.regulator === "ASIC");

  const ReportCard = ({ report }: { report: RegulatoryReport }) => (
    <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {getRegulatorBadge(report.regulator)}
            <Badge variant="outline" className="text-xs capitalize">{report.frequency}</Badge>
          </div>
          <h4 className="font-medium text-white">{report.reportName}</h4>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleToggle(report)}
          className={report.enabled ? "text-green-400" : "text-slate-500"}
        >
          {report.enabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Next Run</span>
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-blue-400" />
            <span className="text-white">{getTimeUntil(report.nextRun)}</span>
          </div>
        </div>
        
        {report.lastRun && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Last Run</span>
            <div className="flex items-center gap-2">
              {report.lastStatus === "success" && <CheckCircle2 className="h-3 w-3 text-green-400" />}
              {report.lastStatus === "failed" && <AlertTriangle className="h-3 w-3 text-red-400" />}
              {report.lastStatus === "pending" && <Clock className="h-3 w-3 text-yellow-400" />}
              <span className="text-slate-300">{formatDate(report.lastRun)}</span>
            </div>
          </div>
        )}
        
        {report.lastHash && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Hash</span>
            <span className="text-xs font-mono text-slate-500">{report.lastHash.slice(7, 19)}...</span>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => handleRunNow(report)}
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Run Now
        </Button>
        <Button variant="ghost" size="sm">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-panel border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">AML Reports</p>
                <p className="text-xl font-bold text-white">{amlReports.length} scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Building2 className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">APRA Reports</p>
                <p className="text-xl font-bold text-white">{apraReports.length} scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <CreditCard className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">ASIC Reports</p>
                <p className="text-xl font-bold text-white">{asicReports.length} scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AML Reports */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-white">AML Reports</CardTitle>
          </div>
          <CardDescription>Anti-Money Laundering compliance reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {amlReports.map(report => (
              <ReportCard key={report.reportId} report={report} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* APRA Reports */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-white">APRA Reports</CardTitle>
          </div>
          <CardDescription>Australian Prudential Regulation Authority reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apraReports.map(report => (
              <ReportCard key={report.reportId} report={report} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ASIC Reports */}
      <Card className="glass-panel border-slate-700/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-white">ASIC Reports</CardTitle>
          </div>
          <CardDescription>Australian Securities and Investments Commission reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {asicReports.map(report => (
              <ReportCard key={report.reportId} report={report} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReportingDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Reporting</h1>
              <p className="text-slate-400">Statements, Finance Feeds & Regulatory Reports</p>
            </div>
          </div>
          
          {/* Governance Banner */}
          <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm text-blue-300 font-medium">Governance Guarantee</p>
                <p className="text-sm text-slate-400">
                  All reports are deterministic projections derived from the Ledger. 
                  Same inputs produce identical outputs with verifiable hashes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="statements" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="statements" className="data-[state=active]:bg-blue-600">
              <FileText className="h-4 w-4 mr-2" />
              Statements
            </TabsTrigger>
            <TabsTrigger value="trial-balance" className="data-[state=active]:bg-blue-600">
              <Scale className="h-4 w-4 mr-2" />
              Trial Balance
            </TabsTrigger>
            <TabsTrigger value="regulatory" className="data-[state=active]:bg-blue-600">
              <Shield className="h-4 w-4 mr-2" />
              Regulatory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="statements">
            <StatementGenerationSection />
          </TabsContent>

          <TabsContent value="trial-balance">
            <TrialBalanceSection />
          </TabsContent>

          <TabsContent value="regulatory">
            <RegulatoryReportsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
