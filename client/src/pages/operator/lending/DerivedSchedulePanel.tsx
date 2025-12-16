/**
 * Lending Operator UI - Derived Schedule Panel
 * 
 * Shows derived repayment schedule.
 * CRITICAL: Derived. Not authoritative.
 */

import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

interface DerivedSchedulePanelProps {
  loanId: string;
}

export function DerivedSchedulePanel({ loanId }: DerivedSchedulePanelProps) {
  // TODO: Add tRPC endpoint for derived schedule
  // const { data: schedule } = trpc.lending.getDerivedSchedule.useQuery({ loanId });

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-2">Derived Repayment Schedule</h2>
      <p className="text-sm text-muted-foreground mb-6">
        <em>Derived. Not authoritative.</em>
      </p>

      <div className="bg-muted p-4 rounded">
        <p className="text-sm text-muted-foreground">
          Derived schedule calculation coming soon. This will show:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
          <li>Next payment due date and amount</li>
          <li>Principal vs interest breakdown</li>
          <li>Hardship adjustments (if applicable)</li>
          <li>Restructure impacts (if applicable)</li>
          <li>Projected payoff date</li>
        </ul>
      </div>

      {/* Placeholder for schedule table */}
      <div className="mt-6">
        <div className="text-sm font-medium mb-2">Schedule Preview</div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Due Date</th>
                <th className="text-right p-3">Principal</th>
                <th className="text-right p-3">Interest</th>
                <th className="text-right p-3">Total Due</th>
                <th className="text-right p-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  Schedule calculation not yet implemented
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
