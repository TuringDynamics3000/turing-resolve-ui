import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  History,
  Percent,
  Calendar,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

export default function OperationsPage() {
  const [isRunningFX, setIsRunningFX] = useState(false);
  const [isRunningAccrual, setIsRunningAccrual] = useState(false);
  const [isRunningCap, setIsRunningCap] = useState(false);
  const [isRunningRecon, setIsRunningRecon] = useState(false);

  // FX Queries
  const fxPositions = trpc.gl.getFXPositions.useQuery();
  const fxHistory = trpc.gl.getFXRevaluationHistory.useQuery();
  const runFXRevaluation = trpc.gl.runFXRevaluation.useMutation();

  // Interest Queries
  const interestAccounts = trpc.gl.getInterestAccounts.useQuery();
  const schedulerHistory = trpc.gl.getSchedulerHistory.useQuery();
  const runDailyAccrual = trpc.gl.runDailyAccrual.useMutation();
  const runCapitalization = trpc.gl.runCapitalization.useMutation();
  const runEODReconciliation = trpc.gl.runEODReconciliation.useMutation();

  const today = new Date().toISOString().split("T")[0];

  const handleRunFXRevaluation = async () => {
    setIsRunningFX(true);
    try {
      const result = await runFXRevaluation.mutateAsync({ periodEnd: today });
      toast.success(`FX Revaluation completed: ${result.positionsProcessed} positions processed`);
      fxPositions.refetch();
      fxHistory.refetch();
    } catch (error) {
      toast.error("FX Revaluation failed");
    }
    setIsRunningFX(false);
  };

  const handleRunDailyAccrual = async () => {
    setIsRunningAccrual(true);
    try {
      const result = await runDailyAccrual.mutateAsync({ accrualDate: today });
      toast.success(`Daily accrual completed: ${result.accountsProcessed} accounts, ${result.totalInterest} interest`);
      interestAccounts.refetch();
      schedulerHistory.refetch();
    } catch (error) {
      toast.error("Daily accrual failed");
    }
    setIsRunningAccrual(false);
  };

  const handleRunCapitalization = async () => {
    setIsRunningCap(true);
    try {
      const result = await runCapitalization.mutateAsync({ capitalizationDate: today });
      toast.success(`Capitalization completed: ${result.accountsProcessed} accounts, ${result.totalCapitalized} capitalized`);
      interestAccounts.refetch();
      schedulerHistory.refetch();
    } catch (error) {
      toast.error("Capitalization failed");
    }
    setIsRunningCap(false);
  };

  const handleRunReconciliation = async () => {
    setIsRunningRecon(true);
    try {
      const result = await runEODReconciliation.mutateAsync({ reconciliationDate: today });
      if (result.isBalanced) {
        toast.success("EOD Reconciliation: BALANCED");
      } else {
        toast.warning(`EOD Reconciliation: Variance of ${result.variance}`);
      }
      schedulerHistory.refetch();
    } catch (error) {
      toast.error("Reconciliation failed");
    }
    setIsRunningRecon(false);
  };

  // Calculate FX summary
  const fxSummary = {
    totalPositions: fxPositions.data?.totalPositions || 0,
    totalGainLoss: fxPositions.data?.positions.reduce((sum, p) => sum + p.unrealizedGainLossCents, 0) || 0,
    gains: fxPositions.data?.positions.filter(p => p.unrealizedGainLossCents > 0).length || 0,
    losses: fxPositions.data?.positions.filter(p => p.unrealizedGainLossCents < 0).length || 0,
  };

  // Calculate Interest summary
  const interestSummary = {
    totalAccounts: interestAccounts.data?.totalAccounts || 0,
    activeAccounts: interestAccounts.data?.activeAccounts || 0,
    totalAccrued: interestAccounts.data?.accounts.reduce((sum, a) => sum + a.accruedInterestCents, 0) || 0,
    deposits: interestAccounts.data?.accounts.filter(a => a.accountType === "DEPOSIT").length || 0,
    loans: interestAccounts.data?.accounts.filter(a => a.accountType === "LOAN" || a.accountType === "CREDIT_CARD" || a.accountType === "OVERDRAFT").length || 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Calculator className="w-8 h-8 text-blue-400" />
          Ledger Operations
        </h1>
        <p className="text-slate-400 mt-1">FX Revaluation & Interest Processing</p>
      </div>

      <Tabs defaultValue="fx" className="space-y-6">
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="fx" className="data-[state=active]:bg-blue-600">
            <DollarSign className="w-4 h-4 mr-2" />
            FX Revaluation
          </TabsTrigger>
          <TabsTrigger value="interest" className="data-[state=active]:bg-blue-600">
            <Percent className="w-4 h-4 mr-2" />
            Interest Processing
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-blue-600">
            <History className="w-4 h-4 mr-2" />
            Run History
          </TabsTrigger>
        </TabsList>

        {/* FX Revaluation Tab */}
        <TabsContent value="fx" className="space-y-6">
          {/* FX Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">FX Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{fxSummary.totalPositions}</div>
                <p className="text-xs text-slate-500">Multi-currency accounts</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Unrealized P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${fxSummary.totalGainLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(fxSummary.totalGainLoss / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                </div>
                <p className="text-xs text-slate-500">Net gain/loss</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Gains
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">{fxSummary.gains}</div>
                <p className="text-xs text-slate-500">Positions in gain</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Losses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{fxSummary.losses}</div>
                <p className="text-xs text-slate-500">Positions in loss</p>
              </CardContent>
            </Card>
          </div>

          {/* Run FX Revaluation */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Run FX Revaluation</CardTitle>
                  <CardDescription>Revalue all multi-currency positions at current spot rates</CardDescription>
                </div>
                <Button 
                  onClick={handleRunFXRevaluation}
                  disabled={isRunningFX}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Play className={`w-4 h-4 mr-2 ${isRunningFX ? "animate-spin" : ""}`} />
                  {isRunningFX ? "Running..." : "Run Revaluation"}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* FX Positions Table */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Currency Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Account</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Currency</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Balance</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">AUD Cost</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">AUD Value</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fxPositions.data?.positions.map((position) => (
                      <tr key={position.accountId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{position.accountName}</div>
                          <div className="text-xs text-slate-500">{position.accountId}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-slate-300">{position.currency}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-white">{position.balance}</td>
                        <td className="py-3 px-4 text-right text-slate-400">{position.originalAudCost}</td>
                        <td className="py-3 px-4 text-right text-white">{position.currentAudValue}</td>
                        <td className={`py-3 px-4 text-right font-medium ${position.unrealizedGainLossCents >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {position.unrealizedGainLoss}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interest Processing Tab */}
        <TabsContent value="interest" className="space-y-6">
          {/* Interest Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Active Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{interestSummary.activeAccounts}</div>
                <p className="text-xs text-slate-500">of {interestSummary.totalAccounts} total</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Total Accrued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">
                  {(interestSummary.totalAccrued / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                </div>
                <p className="text-xs text-slate-500">Pending capitalization</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-400">Deposits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{interestSummary.deposits}</div>
                <p className="text-xs text-slate-500">Interest payable</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400">Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">{interestSummary.loans}</div>
                <p className="text-xs text-slate-500">Interest receivable</p>
              </CardContent>
            </Card>
          </div>

          {/* Scheduler Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Daily Accrual
                </CardTitle>
                <CardDescription>Calculate and post daily interest</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleRunDailyAccrual}
                  disabled={isRunningAccrual}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Play className={`w-4 h-4 mr-2 ${isRunningAccrual ? "animate-spin" : ""}`} />
                  {isRunningAccrual ? "Running..." : "Run Accrual"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  Capitalization
                </CardTitle>
                <CardDescription>Apply accrued interest to balances</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleRunCapitalization}
                  disabled={isRunningCap}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  <Play className={`w-4 h-4 mr-2 ${isRunningCap ? "animate-spin" : ""}`} />
                  {isRunningCap ? "Running..." : "Run Capitalization"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  EOD Reconciliation
                </CardTitle>
                <CardDescription>Verify accruals match postings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleRunReconciliation}
                  disabled={isRunningRecon}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Play className={`w-4 h-4 mr-2 ${isRunningRecon ? "animate-spin" : ""}`} />
                  {isRunningRecon ? "Running..." : "Run Reconciliation"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Interest Accounts Table */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Interest-Bearing Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Account</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Customer</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">Type</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Balance</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">Rate</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Accrued</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">Cap Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestAccounts.data?.accounts.map((account) => (
                      <tr key={account.accountId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="text-white font-mono text-sm">{account.accountId}</div>
                          <div className="text-xs text-slate-500">{account.productCode}</div>
                        </td>
                        <td className="py-3 px-4 text-white">{account.customerName}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant="outline" 
                            className={account.accountType === "DEPOSIT" ? "text-blue-400 border-blue-500/30" : "text-emerald-400 border-emerald-500/30"}
                          >
                            {account.accountType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-white">{account.balance}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{account.annualRate}</td>
                        <td className="py-3 px-4 text-right text-amber-400">{account.accruedInterest}</td>
                        <td className="py-3 px-4 text-center text-slate-400">{account.capitalizationDay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FX Revaluation History */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                  FX Revaluation Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fxHistory.data?.runs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No revaluation runs yet</p>
                ) : (
                  <div className="space-y-3">
                    {fxHistory.data?.runs.map((run) => (
                      <div key={run.runId} className="p-3 rounded-lg bg-slate-800/50 flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{run.periodEnd}</div>
                          <div className="text-xs text-slate-500">{run.positionsProcessed} positions</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400">{run.totalUnrealizedGainLoss}</div>
                          <Badge className="bg-emerald-500/20 text-emerald-400">{run.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scheduler Run History */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Percent className="w-5 h-5 text-amber-400" />
                  Interest Scheduler Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedulerHistory.data?.runs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No scheduler runs yet</p>
                ) : (
                  <div className="space-y-3">
                    {schedulerHistory.data?.runs.slice(0, 10).map((run) => (
                      <div key={run.runId} className="p-3 rounded-lg bg-slate-800/50 flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{run.runDate}</div>
                          <div className="text-xs text-slate-500">{run.runType} - {run.accountsProcessed} accounts</div>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-400">{run.totalInterest}</div>
                          <Badge className="bg-emerald-500/20 text-emerald-400">{run.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Reconciliation History */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                EOD Reconciliations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedulerHistory.data?.reconciliations.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No reconciliations yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {schedulerHistory.data?.reconciliations.map((recon) => (
                    <div key={recon.reconciliationId} className="p-4 rounded-lg bg-slate-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{recon.reconciliationDate}</span>
                        {recon.isBalanced ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Balanced
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Variance
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{recon.completedAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
