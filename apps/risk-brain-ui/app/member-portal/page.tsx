"use client";

import { useState } from "react";

/**
 * Read-Only Member Portal
 * 
 * HARD BOUNDARIES:
 * - No write endpoints
 * - No balance mutations
 * - No payment initiation
 * - View-only: balances, transactions, payment status
 * 
 * MANDATORY COPY:
 * - "Viewing only. To make changes, visit your Credit Union branch or call support."
 * - All amounts shown with "Balance as of [timestamp]"
 */

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  balance: number;
}

interface PaymentStatus {
  id: string;
  date: string;
  recipient: string;
  amount: number;
  status: "PENDING" | "SENT" | "SETTLED" | "FAILED";
  statusMessage: string;
}

// Mock data for demonstration
const mockTransactions: Transaction[] = [
  { id: "TXN-001", date: "2024-12-15 14:30", description: "Direct Deposit - Salary", amount: 3500.00, type: "CREDIT", balance: 5234.50 },
  { id: "TXN-002", date: "2024-12-14 09:15", description: "NPP Transfer - John Smith", amount: -250.00, type: "DEBIT", balance: 1734.50 },
  { id: "TXN-003", date: "2024-12-13 16:45", description: "EFTPOS - Woolworths", amount: -87.35, type: "DEBIT", balance: 1984.50 },
  { id: "TXN-004", date: "2024-12-12 11:00", description: "Interest Credit", amount: 2.15, type: "CREDIT", balance: 2071.85 },
  { id: "TXN-005", date: "2024-12-11 08:30", description: "Direct Debit - Insurance", amount: -145.00, type: "DEBIT", balance: 2069.70 },
];

const mockPayments: PaymentStatus[] = [
  { 
    id: "PAY-001", 
    date: "2024-12-15 10:00", 
    recipient: "Jane Doe", 
    amount: 500.00, 
    status: "SETTLED",
    statusMessage: "Payment completed successfully"
  },
  { 
    id: "PAY-002", 
    date: "2024-12-14 15:30", 
    recipient: "ABC Utilities", 
    amount: 125.50, 
    status: "PENDING",
    statusMessage: "Payment is being processed. This may take up to 24 hours."
  },
  { 
    id: "PAY-003", 
    date: "2024-12-13 09:00", 
    recipient: "XYZ Corp", 
    amount: 1000.00, 
    status: "FAILED",
    statusMessage: "Payment could not be completed. Please contact your Credit Union for assistance."
  },
];

function ReadOnlyBanner() {
  return (
    <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <div>
          <h3 className="text-amber-400 font-semibold">Viewing Only</h3>
          <p className="text-amber-200/80 text-sm mt-1">
            To make changes, visit your Credit Union branch or call support at 1800 XXX XXX.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountSummary() {
  const timestamp = new Date().toLocaleString("en-AU", { 
    dateStyle: "medium", 
    timeStyle: "short" 
  });

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Everyday Account</h2>
          <p className="text-slate-400 text-sm">BSB: 062-000 | Account: ****4567</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-green-400">$5,234.50</p>
          <p className="text-slate-500 text-xs mt-1">Balance as of {timestamp}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-slate-400 text-sm">Available Balance</p>
          <p className="text-white font-semibold">$5,234.50</p>
        </div>
        <div>
          <p className="text-slate-400 text-sm">Pending Transactions</p>
          <p className="text-white font-semibold">$125.50</p>
        </div>
      </div>
    </div>
  );
}

function TransactionHistory() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
      
      <div className="space-y-3">
        {mockTransactions.map((txn) => (
          <div key={txn.id} className="flex justify-between items-center py-3 border-b border-slate-700 last:border-0">
            <div className="flex-1">
              <p className="text-white font-medium">{txn.description}</p>
              <p className="text-slate-500 text-sm">{txn.date}</p>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${txn.type === "CREDIT" ? "text-green-400" : "text-red-400"}`}>
                {txn.type === "CREDIT" ? "+" : ""}{txn.amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
              </p>
              <p className="text-slate-500 text-xs">Bal: {txn.balance.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</p>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-slate-500 text-xs mt-4 text-center">
        Showing last 5 transactions. For full statement, visit your Credit Union.
      </p>
    </div>
  );
}

function PaymentStatusView() {
  const getStatusBadge = (status: PaymentStatus["status"]) => {
    const styles = {
      PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      SETTLED: "bg-green-500/20 text-green-400 border-green-500/30",
      FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return styles[status];
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Payment Status</h3>
      
      <div className="space-y-4">
        {mockPayments.map((payment) => (
          <div key={payment.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-white font-medium">{payment.recipient}</p>
                <p className="text-slate-500 text-sm">{payment.date}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">
                  {payment.amount.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                </p>
                <span className={`inline-block px-2 py-0.5 text-xs rounded border ${getStatusBadge(payment.status)}`}>
                  {payment.status}
                </span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-slate-400 text-sm">{payment.statusMessage}</p>
              {payment.status === "FAILED" && (
                <p className="text-amber-400 text-xs mt-2">
                  ⚠️ If you believe this is an error, please contact your Credit Union.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
        <p className="text-slate-400 text-sm">
          <strong className="text-white">Note:</strong> Payment status is updated automatically. 
          Refresh the page to see the latest status. For urgent enquiries, contact your Credit Union.
        </p>
      </div>
    </div>
  );
}

export default function MemberPortalPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "payments">("overview");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Member Portal</h1>
            <p className="text-slate-400 text-sm">TuringCore Credit Union</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-slate-400 text-sm">Read-Only Mode</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <ReadOnlyBanner />
        
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "overview" 
                ? "bg-blue-600 text-white" 
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Account Overview
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "payments" 
                ? "bg-blue-600 text-white" 
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Payment Status
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" ? (
          <>
            <AccountSummary />
            <TransactionHistory />
          </>
        ) : (
          <PaymentStatusView />
        )}

        {/* Footer Notice */}
        <div className="mt-8 p-4 bg-slate-800/30 border border-slate-700 rounded-lg text-center">
          <p className="text-slate-400 text-sm">
            This is a read-only view of your account. For any transactions or changes, 
            please visit your local Credit Union branch or call <strong className="text-white">1800 XXX XXX</strong>.
          </p>
        </div>
      </main>
    </div>
  );
}
