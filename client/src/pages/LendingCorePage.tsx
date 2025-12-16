import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  ChevronRight,
  Heart,
  Ban,
} from "lucide-react";

const STATE_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  OFFERED: { bg: "bg-slate-100", text: "text-slate-700", icon: <FileText className="h-3 w-3" /> },
  ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  IN_ARREARS: { bg: "bg-amber-100", text: "text-amber-700", icon: <AlertTriangle className="h-3 w-3" /> },
  HARDSHIP: { bg: "bg-blue-100", text: "text-blue-700", icon: <Heart className="h-3 w-3" /> },
  DEFAULT: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="h-3 w-3" /> },
  CLOSED: { bg: "bg-gray-100", text: "text-gray-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  WRITTEN_OFF: { bg: "bg-purple-100", text: "text-purple-700", icon: <Ban className="h-3 w-3" /> },
};

const FACT_TYPE_LABELS: Record<string, string> = {
  LOAN_OFFERED: "Loan Offered",
  LOAN_ACCEPTED: "Loan Accepted",
  LOAN_ACTIVATED: "Loan Activated",
  LOAN_PAYMENT_APPLIED: "Payment Applied",
  INTEREST_ACCRUED: "Interest Accrued",
  FEE_APPLIED: "Fee Applied",
  LOAN_IN_ARREARS: "Entered Arrears",
  HARDSHIP_ENTERED: "Hardship Entered",
  HARDSHIP_EXITED: "Hardship Exited",
  LOAN_RESTRUCTURED: "Loan Restructured",
  LOAN_DEFAULTED: "Loan Defaulted",
  LOAN_CLOSED: "Loan Closed",
  LOAN_WRITTEN_OFF: "Loan Written Off",
};

function StateBadge({ state }: { state: string }) {
  const config = STATE_COLORS[state] || STATE_COLORS.OFFERED;
  return (
    <Badge className={`${config.bg} ${config.text} gap-1 font-mono text-xs`}>
      {config.icon}
      {state}
    </Badge>
  );
}

function formatCurrency(amount: string, currency: string = "AUD"): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(num);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercentage(rate: string): string {
  const num = parseFloat(rate) * 100;
  return `${num.toFixed(2)}%`;
}

function OverviewTab({
  loans,
  isLoading,
  onSelectLoan,
}: {
  loans: any[];
  isLoading: boolean;
  onSelectLoan: (loanId: string) => void;
}) {
  const stats = useMemo(() => {
    if (!loans) return { total: 0, byState: {}, totalPrincipal: 0, totalOutstanding: 0 };
    const byState: Record<string, number> = {};
    let totalPrincipal = 0;
    let totalOutstanding = 0;
    for (const loan of loans) {
      byState[loan.state] = (byState[loan.state] || 0) + 1;
      totalPrincipal += parseFloat(loan.principal);
      const outstanding = parseFloat(loan.principal) - parseFloat(loan.principalPaid);
      totalOutstanding += outstanding;
    }
    return { total: loans.length, byState, totalPrincipal, totalOutstanding };
  }, [loans]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Loans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Principal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPrincipal.toString(), "AUD")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Outstanding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding.toString(), "AUD")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active Loans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byState.ACTIVE || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
          <CardDescription>Fact-based loan ledger with deterministic replay</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan ID</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Offered</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No loans found. Create a loan offer to get started.
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((loan) => {
                  const outstanding = parseFloat(loan.principal) - parseFloat(loan.principalPaid);
                  return (
                    <TableRow key={loan.loanId} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{loan.loanId}</TableCell>
                      <TableCell className="font-mono text-xs">{loan.borrowerAccountId}</TableCell>
                      <TableCell>{formatCurrency(loan.principal, "AUD")}</TableCell>
                      <TableCell>{formatPercentage(loan.interestRate)}</TableCell>
                      <TableCell>{loan.termMonths}mo</TableCell>
                      <TableCell>
                        <StateBadge state={loan.state} />
                      </TableCell>
                      <TableCell className={outstanding > 0 ? "font-semibold" : ""}>
                        {formatCurrency(outstanding.toString(), "AUD")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(loan.offeredAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectLoan(loan.loanId)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LoanDetailModal({ loanId, open, onClose }: { loanId: string | null; open: boolean; onClose: () => void }) {
  const { data: loan } = trpc.lending.getLoan.useQuery(
    { loanId: loanId! },
    { enabled: !!loanId }
  );
  const { data: facts } = trpc.lending.getLoanFacts.useQuery(
    { loanId: loanId! },
    { enabled: !!loanId }
  );

  if (!loan || !facts) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const outstanding = parseFloat(loan.principal) - parseFloat(loan.principalPaid);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{loan.loanId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loan Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">State</div>
                <div className="mt-1">
                  <StateBadge state={loan.state} />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Borrower</div>
                <div className="font-mono text-xs mt-1">{loan.borrowerAccountId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Principal</div>
                <div className="font-semibold mt-1">{formatCurrency(loan.principal, "AUD")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Outstanding</div>
                <div className="font-semibold mt-1">{formatCurrency(outstanding.toString(), "AUD")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Interest Rate</div>
                <div className="mt-1">{formatPercentage(loan.interestRate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Term</div>
                <div className="mt-1">{loan.termMonths} months</div>
              </div>
              <div>
                <div className="text-muted-foreground">Principal Paid</div>
                <div className="mt-1">{formatCurrency(loan.principalPaid, "AUD")}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Interest Paid</div>
                <div className="mt-1">{formatCurrency(loan.interestPaid, "AUD")}</div>
              </div>
              {(loan.daysPastDue ?? 0) > 0 && (
                <>
                  <div>
                    <div className="text-muted-foreground">Days Past Due</div>
                    <div className="font-semibold text-amber-600 mt-1">{loan.daysPastDue ?? 0} days</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Amount Overdue</div>
                    <div className="font-semibold text-amber-600 mt-1">
                      {formatCurrency(loan.amountOverdue ?? "0", "AUD")}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Fact Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fact Timeline</CardTitle>
              <CardDescription className="text-xs">
                Immutable event log ({facts.length} facts)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {facts.map((fact: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {FACT_TYPE_LABELS[fact.type] || fact.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(fact.occurredAt)}
                        </span>
                      </div>
                      {fact.type === "LOAN_PAYMENT_APPLIED" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Amount: {formatCurrency(fact.amount.toString(), "AUD")} (Principal:{" "}
                          {formatCurrency(fact.principalPortion.toString(), "AUD")}, Interest:{" "}
                          {formatCurrency(fact.interestPortion.toString(), "AUD")})
                        </div>
                      )}
                      {fact.type === "HARDSHIP_ENTERED" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Reason: {fact.reason} | Approved by: {fact.approvedBy}
                        </div>
                      )}
                      {fact.type === "LOAN_IN_ARREARS" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {fact.daysPastDue} days past due | Overdue:{" "}
                          {formatCurrency(fact.amountOverdue.toString(), "AUD")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LendingCorePage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const { data: loans, isLoading } = trpc.lending.listLoans.useQuery();

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lending Core v1</h1>
        <p className="text-muted-foreground mt-2">
          Fact-based loan primitive with deterministic replay and immutable audit trail
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <DollarSign className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="active">
            <TrendingUp className="h-4 w-4 mr-2" />
            Active Loans
          </TabsTrigger>
          <TabsTrigger value="arrears">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Arrears
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            loans={loans || []}
            isLoading={isLoading}
            onSelectLoan={setSelectedLoanId}
          />
        </TabsContent>

        <TabsContent value="active">
          <OverviewTab
            loans={(loans || []).filter((l: any) => l.state === "ACTIVE")}
            isLoading={isLoading}
            onSelectLoan={setSelectedLoanId}
          />
        </TabsContent>

        <TabsContent value="arrears">
          <OverviewTab
            loans={(loans || []).filter((l: any) => l.state === "IN_ARREARS" || l.state === "DEFAULT")}
            isLoading={isLoading}
            onSelectLoan={setSelectedLoanId}
          />
        </TabsContent>
      </Tabs>

      <LoanDetailModal
        loanId={selectedLoanId}
        open={!!selectedLoanId}
        onClose={() => setSelectedLoanId(null)}
      />
    </div>
  );
}
