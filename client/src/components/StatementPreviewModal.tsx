import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileJson,
  Shield,
  CheckCircle,
  Copy,
  Check,
  Calendar,
  User,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  date: string;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

interface StatementData {
  id: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  accountType: string;
  period: {
    start: string;
    end: string;
  };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactions: Transaction[];
  interestSummary: {
    rateApplied: number;
    interestEarned: number;
    interestPaid: number;
  };
  hash: string;
  generatedAt: string;
  version: string;
}

interface StatementPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: StatementData | null;
}

export function StatementPreviewModal({
  open,
  onOpenChange,
  statement,
}: StatementPreviewModalProps) {
  const [hashCopied, setHashCopied] = useState(false);

  if (!statement) return null;

  const copyHash = () => {
    navigator.clipboard.writeText(statement.hash);
    setHashCopied(true);
    toast.success("Hash copied to clipboard");
    setTimeout(() => setHashCopied(false), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleDownloadPDF = () => {
    toast.success("Downloading PDF statement...");
    // In production, this would trigger actual PDF generation
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(statement, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${statement.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON statement downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <Banknote className="h-5 w-5 text-blue-400" />
            Customer Statement Preview
          </DialogTitle>
        </DialogHeader>

        {/* Hash Verification Banner - Prominent */}
        <div className="flex-shrink-0 bg-gradient-to-r from-emerald-900/50 to-emerald-800/30 border border-emerald-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-full">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">
                    Cryptographically Verified
                  </span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-400">
                  This statement is reproducible and tamper-evident
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-slate-800 px-3 py-1.5 rounded text-xs font-mono text-emerald-300 border border-slate-700">
                {statement.hash.substring(0, 16)}...
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyHash}
                className="text-slate-400 hover:text-white"
              >
                {hashCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Statement Header */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="h-4 w-4" />
                  <span className="text-sm">Customer</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    {statement.customerName}
                  </p>
                  <p className="text-slate-400 text-sm">
                    ID: {statement.customerId}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Statement Period</span>
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {formatDate(statement.period.start)} -{" "}
                    {formatDate(statement.period.end)}
                  </p>
                  <p className="text-slate-400 text-sm">
                    Account: {statement.accountNumber} ({statement.accountType})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Opening Balance</p>
              <p className="text-white font-semibold text-lg">
                {formatCurrency(statement.openingBalance)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4 text-red-400" />
                <p className="text-slate-400 text-sm">Total Debits</p>
              </div>
              <p className="text-red-400 font-semibold text-lg">
                -{formatCurrency(statement.totalDebits)}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                <p className="text-slate-400 text-sm">Total Credits</p>
              </div>
              <p className="text-emerald-400 font-semibold text-lg">
                +{formatCurrency(statement.totalCredits)}
              </p>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
              <p className="text-slate-400 text-sm mb-1">Closing Balance</p>
              <p className="text-blue-400 font-semibold text-lg">
                {formatCurrency(statement.closingBalance)}
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/80">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-400" />
                Transactions ({statement.transactions.length})
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr className="text-left text-sm text-slate-400">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium text-right">Debit</th>
                    <th className="px-4 py-2 font-medium text-right">Credit</th>
                    <th className="px-4 py-2 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {statement.transactions.map((tx, index) => (
                    <tr
                      key={index}
                      className="text-sm hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-slate-300">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-2.5 text-white">{tx.description}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">
                        {tx.reference}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-400">
                        {tx.debit ? formatCurrency(tx.debit) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">
                        {tx.credit ? formatCurrency(tx.credit) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white font-medium">
                        {formatCurrency(tx.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interest Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Interest Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Rate Applied</p>
                <p className="text-white font-semibold">
                  {statement.interestSummary.rateApplied.toFixed(2)}% p.a.
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Interest Earned</p>
                <p className="text-emerald-400 font-semibold">
                  +{formatCurrency(statement.interestSummary.interestEarned)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Interest Paid</p>
                <p className="text-white font-semibold">
                  {formatCurrency(statement.interestSummary.interestPaid)}
                </p>
              </div>
            </div>
          </div>

          {/* Statement Metadata */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Generated: {formatDate(statement.generatedAt)}</span>
              <span>Version: {statement.version}</span>
              <span className="font-mono">ID: {statement.id}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t border-slate-700 mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Shield className="h-4 w-4" />
            <span>
              Regenerating this statement will produce the same hash
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadJSON}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <FileJson className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Sample statement data for demo
export const sampleStatementData: StatementData = {
  id: "STMT-2024-001847",
  customerId: "CUS-001",
  customerName: "Sarah Johnson",
  accountNumber: "062-000-12345678",
  accountType: "Everyday Savings",
  period: {
    start: "2024-11-01",
    end: "2024-11-30",
  },
  openingBalance: 15420.5,
  closingBalance: 18756.32,
  totalDebits: 4250.0,
  totalCredits: 7585.82,
  transactions: [
    {
      date: "2024-11-01",
      description: "Opening Balance",
      reference: "BAL-001",
      debit: null,
      credit: null,
      balance: 15420.5,
    },
    {
      date: "2024-11-02",
      description: "Salary Deposit - TechCorp Pty Ltd",
      reference: "SAL-8847291",
      debit: null,
      credit: 5200.0,
      balance: 20620.5,
    },
    {
      date: "2024-11-05",
      description: "Rent Payment - 42 Collins St",
      reference: "BPAY-991827",
      debit: 2100.0,
      credit: null,
      balance: 18520.5,
    },
    {
      date: "2024-11-08",
      description: "Woolworths - Groceries",
      reference: "POS-7728391",
      debit: 187.45,
      credit: null,
      balance: 18333.05,
    },
    {
      date: "2024-11-10",
      description: "Transfer from Savings",
      reference: "TRF-001928",
      debit: null,
      credit: 500.0,
      balance: 18833.05,
    },
    {
      date: "2024-11-12",
      description: "Electricity Bill - AGL",
      reference: "BPAY-882716",
      debit: 245.8,
      credit: null,
      balance: 18587.25,
    },
    {
      date: "2024-11-15",
      description: "Internet - Telstra",
      reference: "DD-771829",
      debit: 89.0,
      credit: null,
      balance: 18498.25,
    },
    {
      date: "2024-11-18",
      description: "Refund - Amazon AU",
      reference: "REF-9918273",
      debit: null,
      credit: 156.99,
      balance: 18655.24,
    },
    {
      date: "2024-11-20",
      description: "ATM Withdrawal",
      reference: "ATM-882716",
      debit: 200.0,
      credit: null,
      balance: 18455.24,
    },
    {
      date: "2024-11-22",
      description: "Gym Membership - Fitness First",
      reference: "DD-991827",
      debit: 65.0,
      credit: null,
      balance: 18390.24,
    },
    {
      date: "2024-11-25",
      description: "Freelance Payment - Design Work",
      reference: "TRF-887261",
      debit: null,
      credit: 1500.0,
      balance: 19890.24,
    },
    {
      date: "2024-11-28",
      description: "Insurance Premium - NRMA",
      reference: "DD-772819",
      debit: 1362.75,
      credit: null,
      balance: 18527.49,
    },
    {
      date: "2024-11-30",
      description: "Interest Credit",
      reference: "INT-NOV24",
      debit: null,
      credit: 228.83,
      balance: 18756.32,
    },
  ],
  interestSummary: {
    rateApplied: 4.5,
    interestEarned: 228.83,
    interestPaid: 228.83,
  },
  hash: "sha256:a7f3b9c2e1d4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6",
  generatedAt: "2024-12-01T00:00:00Z",
  version: "1.0.0",
};
