import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  Globe,
  DollarSign,
  RefreshCw,
  Info,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const CURRENCY_FLAGS: Record<string, string> = {
  AUD: "🇦🇺",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  NZD: "🇳🇿",
  JPY: "🇯🇵",
  SGD: "🇸🇬",
  HKD: "🇭🇰",
  CNY: "🇨🇳",
  CHF: "🇨🇭",
};

const CURRENCY_NAMES: Record<string, string> = {
  AUD: "Australian Dollar",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  NZD: "New Zealand Dollar",
  JPY: "Japanese Yen",
  SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar",
  CNY: "Chinese Yuan",
  CHF: "Swiss Franc",
};

export default function WalletsPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [fromCurrency, setFromCurrency] = useState("AUD");
  const [toCurrency, setToCurrency] = useState("USD");
  const [convertAmount, setConvertAmount] = useState("");

  // Queries
  const { data: walletsData, refetch: refetchWallets } = trpc.gl.getAllCustomerWallets.useQuery();
  const { data: walletData, refetch: refetchWallet } = trpc.gl.getCustomerWallet.useQuery(
    { customerId: selectedCustomerId! },
    { enabled: !!selectedCustomerId }
  );
  const { data: ratesData } = trpc.gl.getFXRates.useQuery();
  const { data: quoteData, refetch: refetchQuote } = trpc.gl.getFXQuote.useQuery(
    {
      customerId: selectedCustomerId!,
      fromCurrency,
      toCurrency,
      fromAmountCents: Math.round(parseFloat(convertAmount || "0") * 100),
    },
    { enabled: !!selectedCustomerId && !!convertAmount && parseFloat(convertAmount) > 0 && fromCurrency !== toCurrency }
  );
  const { data: historyData } = trpc.gl.getFXTransactionHistory.useQuery(
    { customerId: selectedCustomerId! },
    { enabled: !!selectedCustomerId }
  );

  // Mutations
  const executeConversion = trpc.gl.executeFXConversion.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Converted ${data.fromAmount} to ${data.toAmount}`);
        setConvertDialogOpen(false);
        setConvertAmount("");
        refetchWallet();
        refetchWallets();
      } else {
        toast.error(data.error || "Conversion failed");
      }
    },
    onError: (error) => {
      toast.error(`Conversion failed: ${error.message}`);
    },
  });

  const handleConvert = () => {
    if (!selectedCustomerId || !convertAmount || parseFloat(convertAmount) <= 0) return;

    executeConversion.mutate({
      customerId: selectedCustomerId,
      fromCurrency,
      toCurrency,
      fromAmountCents: Math.round(parseFloat(convertAmount) * 100),
      quoteId: quoteData?.quoteId,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="w-8 h-8 text-cyan-500" />
              Multi-Currency Wallets
            </h1>
            <p className="text-muted-foreground mt-1">
              Customer currency balances with real-time FX conversion
            </p>
          </div>
          <Button variant="outline" onClick={() => { refetchWallets(); refetchWallet(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* FX Rates Banner */}
        {ratesData && (
          <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-cyan-500" />
                <span className="text-sm font-medium text-foreground">Live FX Rates (AUD Base)</span>
              </div>
              <div className="flex flex-wrap gap-4">
                {ratesData.rates.slice(0, 6).map((rate) => (
                  <div key={rate.quoteCurrency} className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2">
                    <span className="text-lg">{CURRENCY_FLAGS[rate.quoteCurrency]}</span>
                    <span className="text-sm font-medium">{rate.quoteCurrency}</span>
                    <span className="text-sm text-muted-foreground">{rate.midRate}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Customers</CardTitle>
              <CardDescription>Select a customer to view wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {walletsData?.wallets.map((wallet) => (
                <button
                  key={wallet.customerId}
                  onClick={() => setSelectedCustomerId(wallet.customerId)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedCustomerId === wallet.customerId
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-border hover:border-cyan-500/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">{wallet.customerName}</div>
                      <div className="text-xs text-muted-foreground">{wallet.customerId}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {wallet.currencies.slice(0, 4).map((c) => (
                        <span key={c} className="text-sm">{CURRENCY_FLAGS[c]}</span>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {wallet.currencyCount} {wallet.currencyCount === 1 ? "currency" : "currencies"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-cyan-500">
                      {wallet.totalValue} total
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {CURRENCY_FLAGS[wallet.reportingCurrency]} {wallet.reportingCurrency}
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Wallet Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {walletData ? walletData.customerName : "Select a Customer"}
                  </CardTitle>
                  <CardDescription>
                    {walletData ? (
                      <span className="flex items-center gap-2">
                        Total: {walletData.totalValue}
                        <Badge variant="outline" className="text-xs">
                          {CURRENCY_FLAGS[walletData.reportingCurrency]} {walletData.reportingCurrency}
                        </Badge>
                        <span className="text-muted-foreground">({walletData.totalValueAUD} AUD)</span>
                      </span>
                    ) : "Choose a customer to view their wallet"}
                  </CardDescription>
                </div>
                {walletData && (
                  <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-cyan-600 hover:bg-cyan-700">
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Convert Currency
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Currency Conversion</DialogTitle>
                        <DialogDescription>
                          Convert between currencies in {walletData.customerName}'s wallet
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>From</Label>
                            <Select value={fromCurrency} onValueChange={setFromCurrency}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {walletData.balances.map((b) => (
                                  <SelectItem key={b.currency} value={b.currency}>
                                    {CURRENCY_FLAGS[b.currency]} {b.currency}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>To</Label>
                            <Select value={toCurrency} onValueChange={setToCurrency}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(CURRENCY_FLAGS).map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {CURRENCY_FLAGS[c]} {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Amount ({fromCurrency})</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={convertAmount}
                            onChange={(e) => setConvertAmount(e.target.value)}
                          />
                        </div>

                        {quoteData && (
                          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">You'll receive</span>
                              <span className="text-lg font-bold text-cyan-500">{quoteData.toAmount}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Exchange rate</span>
                              <span className="text-foreground">{quoteData.customerRate}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Spread</span>
                              <span className="text-foreground">{quoteData.spreadPercent}</span>
                            </div>
                            <div className="border-t border-border pt-3 space-y-2">
                              {quoteData.disclosures.slice(0, 2).map((d) => (
                                <div key={d.code} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{d.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full bg-cyan-600 hover:bg-cyan-700"
                          onClick={handleConvert}
                          disabled={!quoteData || executeConversion.isPending}
                        >
                          {executeConversion.isPending ? "Converting..." : "Confirm Conversion"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {walletData ? (
                <Tabs defaultValue="balances">
                  <TabsList className="mb-4">
                    <TabsTrigger value="balances">Balances</TabsTrigger>
                    <TabsTrigger value="history">Transaction History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="balances" className="space-y-3">
                    {walletData.balances.map((balance) => (
                      <div
                        key={balance.currency}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{CURRENCY_FLAGS[balance.currency]}</span>
                          <div>
                            <div className="font-medium text-foreground">{balance.currency}</div>
                            <div className="text-xs text-muted-foreground">
                              {CURRENCY_NAMES[balance.currency]}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground">{balance.balance}</div>
                          {balance.holdAmount !== "0.00 " + balance.currency && (
                            <div className="text-xs text-amber-500">
                              Hold: {balance.holdAmount}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Available: {balance.availableBalance}
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="history">
                    {historyData && historyData.transactions.length > 0 ? (
                      <div className="space-y-3">
                        {historyData.transactions.map((tx) => (
                          <div
                            key={tx.transactionId}
                            className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                                <ArrowRightLeft className="w-5 h-5 text-cyan-500" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">
                                  {tx.fromCurrency} → {tx.toCurrency}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(tx.executedAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-red-400">-{tx.fromAmount}</div>
                              <div className="text-sm text-green-400">+{tx.toAmount}</div>
                              <div className="text-xs text-muted-foreground">
                                Rate: {tx.customerRate}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                tx.status === "COMPLETED"
                                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                                  : "bg-red-500/10 text-red-500 border-red-500/30"
                              }
                            >
                              {tx.status === "COMPLETED" ? (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              ) : (
                                <AlertCircle className="w-3 h-3 mr-1" />
                              )}
                              {tx.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No conversion history yet</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Select a customer from the list to view their multi-currency wallet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        {walletsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{walletsData.totalWallets}</div>
                    <div className="text-sm text-muted-foreground">Total Wallets</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      ${(walletsData.wallets.reduce((sum, w) => sum + w.totalValueAUDNum, 0) / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-sm text-muted-foreground">Total AUM (AUD)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {new Set(walletsData.wallets.flatMap(w => w.currencies)).size}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Currencies</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {ratesData?.rates.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">FX Pairs Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
