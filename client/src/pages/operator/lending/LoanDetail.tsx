/**
 * Lending Operator UI - Loan Detail Page
 * 
 * Shows fact timeline, derived schedule, and loan actions.
 */

import { useParams } from "wouter";
import { trpc } from "../../../lib/trpc";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { LoanActions } from "./LoanActions";
import { DerivedSchedulePanel } from "./DerivedSchedulePanel";

export function LoanDetail() {
  const params = useParams();
  const loanId = params.loanId as string;

  const { data: loan, isLoading: loanLoading } = trpc.lending.getLoan.useQuery({ loanId });
  const { data: facts, isLoading: factsLoading } = trpc.lending.getFacts.useQuery({ loanId });

  if (loanLoading || factsLoading) {
    return <div className="container py-8">Loading...</div>;
  }

  if (!loan || !facts) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Loan Not Found</h1>
        <p className="text-muted-foreground">Loan {loanId} does not exist.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Loan {loanId}</h1>
        <div className="flex items-center gap-4">
          <LoanStateBadge state={loan.state} />
          <span className="text-muted-foreground">Borrower: {loan.borrowerAccountId}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Principal Outstanding</div>
          <div className="text-2xl font-bold">
            ${(Number(loan.principal) / 100).toLocaleString("en-AU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Interest Rate</div>
          <div className="text-2xl font-bold">{(Number(loan.interestRate) * 100).toFixed(2)}%</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Term</div>
          <div className="text-2xl font-bold">{loan.termMonths} months</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">State</div>
          <div className="text-2xl font-bold">{loan.state}</div>
        </Card>
      </div>

      <Tabs defaultValue="schedule" className="mb-8">
        <TabsList>
          <TabsTrigger value="schedule">Derived Schedule</TabsTrigger>
          <TabsTrigger value="facts">Fact Timeline</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <DerivedSchedulePanel loanId={loanId} />
        </TabsContent>

        <TabsContent value="facts">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Fact Timeline</h2>
            <div className="space-y-4">
              {facts.map((fact, index) => (
                <div key={index} className="border-l-2 border-blue-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{fact.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(fact.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(fact, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <LoanActions loanId={loanId} currentState={loan.state} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoanStateBadge({ state }: { state: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    OFFERED: { variant: "outline", label: "Offered" },
    ACTIVE: { variant: "default", label: "Active" },
    IN_ARREARS: { variant: "destructive", label: "In Arrears" },
    HARDSHIP: { variant: "secondary", label: "Hardship" },
    DEFAULT: { variant: "destructive", label: "Default" },
    CLOSED: { variant: "outline", label: "Closed" },
    WRITTEN_OFF: { variant: "destructive", label: "Written Off" },
  };

  const config = variants[state] || { variant: "outline" as const, label: state };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
