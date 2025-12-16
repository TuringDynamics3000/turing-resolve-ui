/**
 * Lending Operator UI - Loan Actions
 * 
 * Strictly command-driven. Emits facts only.
 * Never mutates derived data.
 * RBAC enforced (placeholder for now).
 */

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { toast } from "sonner";

interface LoanActionsProps {
  loanId: string;
  currentState: string;
}

export function LoanActions({ loanId, currentState }: LoanActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const utils = trpc.useUtils();

  const enterHardship = trpc.lending.enterHardship.useMutation({
    onSuccess: () => {
      toast.success("Hardship arrangement entered");
      utils.lending.getLoan.invalidate({ loanId });
      utils.lending.getFacts.invalidate({ loanId });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to enter hardship: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const exitHardship = trpc.lending.exitHardship.useMutation({
    onSuccess: () => {
      toast.success("Hardship arrangement exited");
      utils.lending.getLoan.invalidate({ loanId });
      utils.lending.getFacts.invalidate({ loanId });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to exit hardship: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const restructure = trpc.lending.restructureLoan.useMutation({
    onSuccess: () => {
      toast.success("Loan restructured");
      utils.lending.getLoan.invalidate({ loanId });
      utils.lending.getFacts.invalidate({ loanId });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to restructure loan: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleEnterHardship = () => {
    setIsProcessing(true);
    enterHardship.mutate({
      loanId,
      reason: "Financial difficulty - operator initiated",
      approvedBy: "OPERATOR-001", // TODO: Get from auth context
    });
  };

  const handleExitHardship = () => {
    setIsProcessing(true);
    exitHardship.mutate({
      loanId,
      reason: "Financial situation improved",
    });
  };

  const handleRestructure = () => {
    setIsProcessing(true);
    restructure.mutate({
      loanId,
      newTermMonths: 60, // Example: extend to 60 months
      reason: "Hardship arrangement - extended term",
      approvedBy: "OPERATOR-001", // TODO: Get from auth context
    });
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Loan Actions</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Commands emit facts only. Never mutate derived data.
      </p>

      <div className="space-y-4">
        {/* Enter Hardship */}
        {(currentState === "ACTIVE" || currentState === "IN_ARREARS") && (
          <div>
            <Button
              onClick={handleEnterHardship}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Enter Hardship
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Pause payments or reduce payment amounts
            </p>
          </div>
        )}

        {/* Exit Hardship */}
        {currentState === "HARDSHIP" && (
          <div>
            <Button
              onClick={handleExitHardship}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Exit Hardship
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Resume normal payment schedule
            </p>
          </div>
        )}

        {/* Restructure Loan */}
        {(currentState === "ACTIVE" || currentState === "HARDSHIP" || currentState === "IN_ARREARS") && (
          <div>
            <Button
              onClick={handleRestructure}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Restructure Loan
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Modify loan terms (rate, term, payment amount)
            </p>
          </div>
        )}

        {currentState === "CLOSED" || currentState === "WRITTEN_OFF" ? (
          <p className="text-sm text-muted-foreground">
            No actions available for {currentState} loans.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
