import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BookOpen, 
  Scale, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  FileText,
  Building2,
  Wallet,
  CreditCard,
  Landmark,
  PiggyBank,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

// Chart of Accounts data (from DoubleEntryLedger.ts)
const CHART_OF_ACCOUNTS = [
  // ASSETS (1xxx)
  { code: "1000", name: "Cash and Cash Equivalents", type: "ASSET", category: "DEPOSITS", isControl: true },
  { code: "1100", name: "Customer Deposits - Control", type: "ASSET", category: "DEPOSITS", isControl: true },
  { code: "1100-SAV", name: "Customer Deposits - Savings", type: "ASSET", category: "DEPOSITS", parent: "1100" },
  { code: "1100-TRM", name: "Customer Deposits - Term", type: "ASSET", category: "DEPOSITS", parent: "1100" },
  { code: "1200", name: "Loans Receivable - Control", type: "ASSET", category: "LOANS", isControl: true },
  { code: "1200-PER", name: "Loans Receivable - Personal", type: "ASSET", category: "LOANS", parent: "1200" },
  { code: "1200-MTG", name: "Loans Receivable - Mortgage", type: "ASSET", category: "LOANS", parent: "1200" },
  { code: "1300", name: "Payment Clearing - Control", type: "ASSET", category: "PAYMENTS", isControl: true },
  { code: "1300-NPP", name: "Payment Clearing - NPP", type: "ASSET", category: "PAYMENTS", parent: "1300" },
  { code: "1300-BECS", name: "Payment Clearing - BECS", type: "ASSET", category: "PAYMENTS", parent: "1300" },
  { code: "1400", name: "Card Settlement - Control", type: "ASSET", category: "CARDS", isControl: true },
  { code: "1900", name: "Suspense Account", type: "ASSET", category: "SUSPENSE" },
  // LIABILITIES (2xxx)
  { code: "2000", name: "Customer Deposits Payable - Control", type: "LIABILITY", category: "DEPOSITS", isControl: true },
  { code: "2000-SAV", name: "Customer Deposits Payable - Savings", type: "LIABILITY", category: "DEPOSITS", parent: "2000" },
  { code: "2000-TRM", name: "Customer Deposits Payable - Term", type: "LIABILITY", category: "DEPOSITS", parent: "2000" },
  { code: "2100", name: "Interest Payable", type: "LIABILITY", category: "DEPOSITS" },
  { code: "2200", name: "Fees Payable", type: "LIABILITY", category: "DEPOSITS" },
  { code: "2900", name: "Provisions - Loan Losses", type: "LIABILITY", category: "LOANS" },
  // EQUITY (3xxx)
  { code: "3000", name: "Share Capital", type: "EQUITY", category: "CAPITAL" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", category: "CAPITAL" },
  { code: "3200", name: "Current Year Profit/Loss", type: "EQUITY", category: "CAPITAL" },
  // REVENUE (4xxx)
  { code: "4000", name: "Interest Income - Loans", type: "REVENUE", category: "REVENUE" },
  { code: "4100", name: "Fee Income", type: "REVENUE", category: "REVENUE" },
  { code: "4200", name: "Card Interchange Income", type: "REVENUE", category: "REVENUE" },
  // EXPENSES (5xxx)
  { code: "5000", name: "Interest Expense - Deposits", type: "EXPENSE", category: "EXPENSE" },
  { code: "5100", name: "Provision Expense - Loan Losses", type: "EXPENSE", category: "EXPENSE" },
  { code: "5200", name: "Payment Processing Fees", type: "EXPENSE", category: "EXPENSE" },
];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LIABILITY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  EQUITY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  REVENUE: "bg-green-500/20 text-green-400 border-green-500/30",
  EXPENSE: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  ASSET: <Wallet className="h-4 w-4" />,
  LIABILITY: <CreditCard className="h-4 w-4" />,
  EQUITY: <Landmark className="h-4 w-4" />,
  REVENUE: <TrendingUp className="h-4 w-4" />,
  EXPENSE: <Receipt className="h-4 w-4" />,
};

// Helper to safely access trial balance data
const getTB = (data: any) => data?.trialBalance || data;

export default function GLLedger() {
  const [activeTab, setActiveTab] = useState("chart");
  const [selectedCurrency, setSelectedCurrency] = useState("AUD");
  const [filterType, setFilterType] = useState<string>("all");
  
  // FX Conversion state
  const [fxAmount, setFxAmount] = useState("100");
  const [fxFrom, setFxFrom] = useState("USD");
  const [fxTo, setFxTo] = useState("AUD");
  
  // Trial balance query
  const trialBalance = trpc.ledger.generateTrialBalance.useQuery(
    { asOfDate: new Date().toISOString().split("T")[0], currency: selectedCurrency },
    { enabled: activeTab === "trial-balance" }
  );
  
  // Reconciliation query
  const reconciliation = trpc.ledger.runFullReconciliation.useQuery(
    { asOfDate: new Date().toISOString().split("T")[0], currency: selectedCurrency },
    { enabled: activeTab === "reconciliation" }
  );
  
  // Supported currencies
  const currencies = trpc.ledger.getSupportedCurrencies.useQuery(undefined, {
    enabled: activeTab === "fx",
  });
  
  // FX conversion
  const fxConversion = trpc.ledger.convertCurrency.useQuery(
    { 
      amountCents: Math.round(parseFloat(fxAmount || "0") * 100),
      fromCurrency: fxFrom,
      toCurrency: fxTo,
      rateType: "MID",
    },
    { enabled: activeTab === "fx" && parseFloat(fxAmount || "0") > 0 }
  );
  
  // Filter accounts
  const filteredAccounts = filterType === "all" 
    ? CHART_OF_ACCOUNTS 
    : CHART_OF_ACCOUNTS.filter(a => a.type === filterType);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "BALANCED":
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case "BREAK":
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case "ERROR":
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "BALANCED":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Balanced</Badge>;
      case "BREAK":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Break Detected</Badge>;
      case "ERROR":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Error</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <BookOpen className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">General Ledger</h1>
            <p className="text-gray-400">Chart of accounts, trial balance, reconciliation, and FX</p>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#12121a] border border-gray-800">
          <TabsTrigger value="chart" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <BookOpen className="h-4 w-4 mr-2" />
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Scale className="h-4 w-4 mr-2" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconciliation
          </TabsTrigger>
          <TabsTrigger value="fx" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            FX Rates
          </TabsTrigger>
        </TabsList>
        
        {/* Chart of Accounts Tab */}
        <TabsContent value="chart" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px] bg-[#12121a] border-gray-800">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent className="bg-[#12121a] border-gray-800">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ASSET">Assets</SelectItem>
                  <SelectItem value="LIABILITY">Liabilities</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="EXPENSE">Expenses</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-400">
                {filteredAccounts.length} accounts
              </span>
            </div>
          </div>
          
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-4 text-gray-400 font-medium">Code</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Account Name</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Type</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Category</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr key={account.code} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-4">
                          <code className="text-emerald-400 font-mono text-sm">{account.code}</code>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {account.parent && <span className="text-gray-600 ml-4">└</span>}
                            <span className={account.parent ? "text-gray-300" : "text-white font-medium"}>
                              {account.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={ACCOUNT_TYPE_COLORS[account.type]}>
                            <span className="flex items-center gap-1">
                              {ACCOUNT_TYPE_ICONS[account.type]}
                              {account.type}
                            </span>
                          </Badge>
                        </td>
                        <td className="p-4 text-gray-400">{account.category}</td>
                        <td className="p-4">
                          {account.isControl && (
                            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                              Control
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-[120px] bg-[#12121a] border-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#12121a] border-gray-800">
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => trialBalance.refetch()}
                className="border-gray-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${trialBalance.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {trialBalance.data && (
              <div className="flex items-center gap-2">
                {getStatusIcon(getTB(trialBalance.data)?.isBalanced ? "BALANCED" : "BREAK")}
                <span className={getTB(trialBalance.data)?.isBalanced ? "text-green-400" : "text-yellow-400"}>
                  {getTB(trialBalance.data)?.isBalanced ? "Trial Balance is Balanced" : "Trial Balance has Variance"}
                </span>
              </div>
            )}
          </div>
          
          {trialBalance.isLoading ? (
            <Card className="bg-[#12121a] border-gray-800 p-8">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            </Card>
          ) : trialBalance.data ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Total Debits</p>
                        <p className="text-xl font-bold text-blue-400">{getTB(trialBalance.data)?.totalDebits}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Total Credits</p>
                        <p className="text-xl font-bold text-purple-400">{getTB(trialBalance.data)?.totalCredits}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <TrendingUp className="h-5 w-5 text-purple-400 rotate-180" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Variance</p>
                        <p className={`text-xl font-bold ${getTB(trialBalance.data)?.isBalanced ? "text-green-400" : "text-yellow-400"}`}>
                          {getTB(trialBalance.data)?.variance}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${getTB(trialBalance.data)?.isBalanced ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                        <Scale className={`h-5 w-5 ${getTB(trialBalance.data)?.isBalanced ? "text-green-400" : "text-yellow-400"}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Account Balances */}
              <Card className="bg-[#12121a] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Account Balances</CardTitle>
                  <CardDescription>As of {getTB(trialBalance.data)?.asOfDate}</CardDescription>
                </CardHeader>
                <CardContent>
                  {(getTB(trialBalance.data)?.accounts || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No account balances to display</p>
                      <p className="text-sm">Commit some postings to see balances</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="text-left p-3 text-gray-400">Account</th>
                            <th className="text-right p-3 text-gray-400">Debits</th>
                            <th className="text-right p-3 text-gray-400">Credits</th>
                            <th className="text-right p-3 text-gray-400">Net Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(getTB(trialBalance.data)?.accounts || []).map((account: any) => (
                            <tr key={account.accountCode} className="border-b border-gray-800/50">
                              <td className="p-3">
                                <div>
                                  <code className="text-emerald-400 font-mono text-sm">{account.accountCode}</code>
                                  <span className="text-gray-300 ml-2">{account.accountName}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right text-blue-400">{account.debitBalance}</td>
                              <td className="p-3 text-right text-purple-400">{account.creditBalance}</td>
                              <td className="p-3 text-right text-white font-medium">{account.netBalance}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-[#12121a] border-gray-800 p-8">
              <div className="text-center text-gray-400">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Unable to load trial balance</p>
              </div>
            </Card>
          )}
        </TabsContent>
        
        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  reconciliation.refetch();
                  toast.success("Reconciliation started");
                }}
                className="border-gray-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reconciliation.isFetching ? "animate-spin" : ""}`} />
                Run Reconciliation
              </Button>
            </div>
            {reconciliation.data && (
              <div className="flex items-center gap-2">
                {getStatusIcon(reconciliation.data.overallStatus)}
                {getStatusBadge(reconciliation.data.overallStatus)}
              </div>
            )}
          </div>
          
          {reconciliation.isLoading ? (
            <Card className="bg-[#12121a] border-gray-800 p-8">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            </Card>
          ) : reconciliation.data ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Sub-Ledgers</p>
                    <p className="text-2xl font-bold text-white">{reconciliation.data.reconciliations.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Breaks</p>
                    <p className={`text-2xl font-bold ${reconciliation.data.totalBreaks === 0 ? "text-green-400" : "text-yellow-400"}`}>
                      {reconciliation.data.totalBreaks}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">Total Variance</p>
                    <p className="text-2xl font-bold text-white">{reconciliation.data.totalVariance}</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-gray-800">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">As Of</p>
                    <p className="text-lg font-medium text-white">{reconciliation.data.asOfDate}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Reconciliation Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reconciliation.data.reconciliations.map((recon: any) => (
                  <Card key={recon.subLedgerType} className="bg-[#12121a] border-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {recon.subLedgerType === "DEPOSITS" && <PiggyBank className="h-5 w-5 text-blue-400" />}
                          {recon.subLedgerType === "LOANS" && <Building2 className="h-5 w-5 text-purple-400" />}
                          {recon.subLedgerType === "PAYMENTS" && <ArrowRightLeft className="h-5 w-5 text-emerald-400" />}
                          {recon.subLedgerType === "CARDS" && <CreditCard className="h-5 w-5 text-orange-400" />}
                          <CardTitle className="text-lg text-white">{recon.subLedgerType}</CardTitle>
                        </div>
                        {getStatusBadge(recon.status)}
                      </div>
                      <CardDescription>Control: {recon.controlAccountCode} - {recon.controlAccountName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Sub-Ledger Total</span>
                          <span className="text-white">{recon.subLedgerTotal}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">GL Control Total</span>
                          <span className="text-white">{recon.glControlTotal}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-gray-800 pt-2">
                          <span className="text-gray-400">Variance</span>
                          <span className={recon.status === "BALANCED" ? "text-green-400" : "text-yellow-400"}>
                            {recon.variance}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Items</span>
                          <span className="text-white">{recon.itemCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card className="bg-[#12121a] border-gray-800 p-8">
              <div className="text-center text-gray-400">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Run Reconciliation" to check sub-ledger balances</p>
              </div>
            </Card>
          )}
        </TabsContent>
        
        {/* FX Rates Tab */}
        <TabsContent value="fx" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Currency Converter */}
            <Card className="bg-[#12121a] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-emerald-400" />
                  Currency Converter
                </CardTitle>
                <CardDescription>Convert between supported currencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={fxAmount}
                    onChange={(e) => setFxAmount(e.target.value)}
                    className="bg-[#0a0a0f] border-gray-700"
                    placeholder="Enter amount"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Select value={fxFrom} onValueChange={setFxFrom}>
                      <SelectTrigger className="bg-[#0a0a0f] border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12121a] border-gray-800">
                        {currencies.data?.map((c: any) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.symbol} {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <Select value={fxTo} onValueChange={setFxTo}>
                      <SelectTrigger className="bg-[#0a0a0f] border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12121a] border-gray-800">
                        {currencies.data?.map((c: any) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.symbol} {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {fxConversion.data && fxConversion.data.success && (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Result</p>
                        <p className="text-2xl font-bold text-emerald-400">{fxConversion.data.toAmount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Rate</p>
                        <p className="text-lg text-white">{fxConversion.data.rateUsed?.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Supported Currencies */}
            <Card className="bg-[#12121a] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  Supported Currencies
                </CardTitle>
                <CardDescription>Multi-currency support for international operations</CardDescription>
              </CardHeader>
              <CardContent>
                {currencies.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {currencies.data?.map((currency: any) => (
                      <div 
                        key={currency.code}
                        className={`p-3 rounded-lg border ${currency.isBaseCurrency ? "bg-emerald-500/10 border-emerald-500/30" : "bg-gray-800/30 border-gray-700"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{currency.symbol}</span>
                          <div>
                            <p className="font-medium text-white">{currency.code}</p>
                            <p className="text-xs text-gray-400">{currency.name}</p>
                          </div>
                        </div>
                        {currency.isBaseCurrency && (
                          <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            Base Currency
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
