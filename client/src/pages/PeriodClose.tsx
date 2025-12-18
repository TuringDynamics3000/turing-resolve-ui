import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Lock, 
  Unlock,
  ArrowRight,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from "lucide-react";

type WizardStep = "select" | "validate" | "preview" | "confirm" | "complete";

export default function PeriodClose() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("select");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // Queries
  const { data: periods, refetch: refetchPeriods } = trpc.gl.listPeriods.useQuery();
  const { data: currentPeriod } = trpc.gl.getCurrentPeriod.useQuery();
  const { data: validation, refetch: refetchValidation } = trpc.gl.validatePeriodForClose.useQuery(
    { periodId: selectedPeriod! },
    { enabled: !!selectedPeriod && currentStep !== "select" }
  );
  const { data: plPreview } = trpc.gl.previewPLRollup.useQuery(
    { periodId: selectedPeriod! },
    { enabled: !!selectedPeriod && (currentStep === "preview" || currentStep === "confirm") }
  );

  // Mutations
  const softClose = trpc.gl.softClosePeriod.useMutation({
    onSuccess: () => {
      toast.success("Period soft-closed successfully");
      refetchPeriods();
      setCurrentStep("preview");
    },
    onError: (error) => {
      toast.error(`Failed to soft-close: ${error.message}`);
    },
  });

  const hardClose = trpc.gl.hardClosePeriod.useMutation({
    onSuccess: () => {
      toast.success("Period closed and P&L rolled up to retained earnings");
      refetchPeriods();
      setCurrentStep("complete");
    },
    onError: (error) => {
      toast.error(`Failed to close period: ${error.message}`);
    },
  });

  const reopenPeriod = trpc.gl.reopenPeriod.useMutation({
    onSuccess: () => {
      toast.success("Period reopened");
      refetchPeriods();
      setCurrentStep("select");
      setSelectedPeriod(null);
    },
    onError: (error) => {
      toast.error(`Failed to reopen: ${error.message}`);
    },
  });

  const handleSelectPeriod = (periodId: string) => {
    setSelectedPeriod(periodId);
    setCurrentStep("validate");
  };

  const handleProceedToPreview = () => {
    if (validation?.isValid) {
      softClose.mutate({ periodId: selectedPeriod! });
    }
  };

  const handleConfirmClose = () => {
    hardClose.mutate({ periodId: selectedPeriod! });
  };

  const getStepProgress = () => {
    switch (currentStep) {
      case "select": return 0;
      case "validate": return 25;
      case "preview": return 50;
      case "confirm": return 75;
      case "complete": return 100;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Open</Badge>;
      case "SOFT_CLOSED":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Soft Closed</Badge>;
      case "CLOSED":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="h-8 w-8 text-cyan-500" />
            Period Close Wizard
          </h1>
          <p className="text-muted-foreground mt-1">
            Month-end close with journal freeze and P&L rollup to retained earnings
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className={currentStep === "select" ? "text-cyan-500 font-medium" : "text-muted-foreground"}>
              Select Period
            </span>
            <span className={currentStep === "validate" ? "text-cyan-500 font-medium" : "text-muted-foreground"}>
              Validate
            </span>
            <span className={currentStep === "preview" ? "text-cyan-500 font-medium" : "text-muted-foreground"}>
              Preview P&L
            </span>
            <span className={currentStep === "confirm" ? "text-cyan-500 font-medium" : "text-muted-foreground"}>
              Confirm
            </span>
            <span className={currentStep === "complete" ? "text-cyan-500 font-medium" : "text-muted-foreground"}>
              Complete
            </span>
          </div>
          <Progress value={getStepProgress()} className="h-2" />
        </div>

        {/* Step Content */}
        {currentStep === "select" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Select Period to Close</CardTitle>
              <CardDescription>
                Current period: {currentPeriod?.periodId} ({currentPeriod?.status})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {periods?.map((period: any) => (
                  <div
                    key={period.periodId}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                      period.status === "OPEN" 
                        ? "border-cyan-500/30 hover:bg-cyan-500/10" 
                        : "border-border opacity-60"
                    }`}
                    onClick={() => period.status === "OPEN" && handleSelectPeriod(period.periodId)}
                  >
                    <div className="flex items-center gap-3">
                      {period.status === "CLOSED" ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-5 w-5 text-cyan-500" />
                      )}
                      <div>
                        <p className="font-medium">{period.periodId}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(period.status)}
                      {period.status === "OPEN" && (
                        <ArrowRight className="h-5 w-5 text-cyan-500" />
                      )}
                      {period.status === "CLOSED" && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            reopenPeriod.mutate({ periodId: period.periodId, reason: "Adjustment required" });
                          }}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "validate" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Validation Checklist
              </CardTitle>
              <CardDescription>
                Period: {selectedPeriod}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(validation as any)?.checks?.map((check: any, idx: number) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    check.passed ? "bg-green-500/10" : "bg-red-500/10"
                  }`}
                >
                  {check.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                    {check.details && (
                      <p className="text-xs mt-1 font-mono">{check.details}</p>
                    )}
                  </div>
                </div>
              ))}

              {(validation as any)?.issues?.length > 0 && (
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Issues to Address
                  </h4>
                  {(validation as any)?.issues?.map((issue: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded mb-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <span className="text-sm">{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setCurrentStep("select")}>
                  Back
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => refetchValidation()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-validate
                </Button>
                <Button 
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  disabled={!validation?.isValid || softClose.isPending}
                  onClick={handleProceedToPreview}
                >
                  {softClose.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Soft Close & Preview P&L
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "preview" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                P&L Rollup Preview
              </CardTitle>
              <CardDescription>
                Review the profit/loss that will be rolled to retained earnings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(Number(plPreview?.totalRevenue) || 0)}
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-muted-foreground">Total Expenses</span>
                  </div>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(Number(plPreview?.totalExpenses) || 0)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg border ${
                  (Number(plPreview?.netIncome) || 0) >= 0 
                    ? "bg-cyan-500/10 border-cyan-500/30" 
                    : "bg-orange-500/10 border-orange-500/30"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-cyan-500" />
                    <span className="text-sm text-muted-foreground">Net Income</span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    (Number(plPreview?.netIncome) || 0) >= 0 ? "text-cyan-500" : "text-orange-500"
                  }`}>
                    {formatCurrency(Number(plPreview?.netIncome) || 0)}
                  </p>
                </div>
              </div>

              {/* Revenue Breakdown */}
              {plPreview?.revenueAccounts && plPreview.revenueAccounts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Revenue Accounts</h4>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3">Account</th>
                          <th className="text-right p-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plPreview.revenueAccounts.map((acc: any, idx: number) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="p-3">{acc.name}</td>
                            <td className="p-3 text-right font-mono text-green-500">
                              {formatCurrency(Number(acc.balance) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Expense Breakdown */}
              {plPreview?.expenseAccounts && plPreview.expenseAccounts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Expense Accounts</h4>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3">Account</th>
                          <th className="text-right p-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plPreview.expenseAccounts.map((acc: any, idx: number) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="p-3">{acc.name}</td>
                            <td className="p-3 text-right font-mono text-red-500">
                              {formatCurrency(Number(acc.balance) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <strong>What happens next:</strong> The net income of {formatCurrency(Number(plPreview?.netIncome) || 0)} will be 
                  transferred to Retained Earnings (account 3200). All revenue and expense accounts will be reset to zero.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setCurrentStep("validate")}>
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => setCurrentStep("confirm")}
                >
                  Proceed to Confirm
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "confirm" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                Confirm Period Close
              </CardTitle>
              <CardDescription>
                This action is irreversible without supervisor approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="font-medium mb-2">You are about to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Permanently close period <strong>{selectedPeriod}</strong></li>
                  <li>Freeze all journal entries for this period</li>
                  <li>Roll up net income of <strong>{formatCurrency(Number(plPreview?.netIncome) || 0)}</strong> to Retained Earnings</li>
                  <li>Reset all revenue and expense accounts to zero</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("preview")}>
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={hardClose.isPending}
                  onClick={handleConfirmClose}
                >
                  {hardClose.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Confirm & Close Period
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "complete" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                Period Closed Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">Period {selectedPeriod} has been closed</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Net income has been rolled to retained earnings. All journal entries are now frozen.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setCurrentStep("select");
                    setSelectedPeriod(null);
                  }}
                >
                  Close Another Period
                </Button>
                <Button 
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => window.location.href = "/gl"}
                >
                  View GL Ledger
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
