/**
 * Lending Operator UI - Overview Page
 * 
 * Read-only by default, command-driven where allowed.
 * Mirrors Payments UI structure.
 */

import { Link } from "wouter";
import { trpc } from "../../../lib/trpc";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

export function LendingOverview() {
  const { data: loans, isLoading } = trpc.lending.listLoans.useQuery();

  if (isLoading) {
    return <div className="container py-8">Loading...</div>;
  }

  if (!loans || loans.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Lending — Core v1</h1>
        <p className="text-muted-foreground">No loans found.</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalLoans = loans.length;
  const activeLoans = loans.filter(l => l.state === "ACTIVE").length;
  const arrearsLoans = loans.filter(l => l.state === "IN_ARREARS").length;
  const hardshipLoans = loans.filter(l => l.state === "HARDSHIP").length;
  const totalPrincipal = loans.reduce((sum, l) => sum + BigInt(l.principal), 0n);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Lending — Core v1</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total Loans</div>
          <div className="text-2xl font-bold">{totalLoans}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold text-green-600">{activeLoans}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">In Arrears</div>
          <div className="text-2xl font-bold text-orange-600">{arrearsLoans}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Hardship</div>
          <div className="text-2xl font-bold text-blue-600">{hardshipLoans}</div>
        </Card>
      </div>

      <div className="mb-4">
        <div className="text-sm text-muted-foreground">Total Principal Outstanding</div>
        <div className="text-3xl font-bold">
          ${(Number(totalPrincipal) / 100).toLocaleString("en-AU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      {/* Loans Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left p-4">Loan ID</th>
                <th className="text-left p-4">Borrower</th>
                <th className="text-left p-4">State</th>
                <th className="text-right p-4">Principal</th>
                <th className="text-left p-4">Last Updated</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.loanId} className="border-b hover:bg-muted/50">
                  <td className="p-4 font-mono text-sm">{loan.loanId}</td>
                  <td className="p-4">{loan.borrowerAccountId}</td>
                  <td className="p-4">
                    <LoanStateBadge state={loan.state} />
                  </td>
                  <td className="p-4 text-right font-mono">
                    ${(Number(loan.principal) / 100).toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(loan.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link href={`/operator/lending/${loan.loanId}`}>
                      <a className="text-blue-600 hover:underline text-sm">View Details</a>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
