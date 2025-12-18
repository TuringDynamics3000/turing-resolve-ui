import { useState } from "react";
import { Search, Filter, Download, ChevronDown } from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================
// TYPES
// ============================================

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  icon: string;
  account: string;
  reference?: string;
}

// ============================================
// MOCK DATA
// ============================================

const TRANSACTIONS: Record<string, Transaction[]> = {
  "Today": [
    { id: "1", description: "Woolworths Metro", amount: -87.52, date: "Today", time: "2:34 PM", category: "Groceries", icon: "🛒", account: "Everyday" },
    { id: "2", description: "Salary - Acme Corp", amount: 4250.00, date: "Today", time: "9:00 AM", category: "Income", icon: "💼", account: "Everyday", reference: "PAY-DEC-2024" },
  ],
  "Yesterday": [
    { id: "3", description: "Netflix", amount: -22.99, date: "Yesterday", time: "11:00 PM", category: "Entertainment", icon: "📺", account: "Everyday" },
    { id: "4", description: "Shell Coles Express", amount: -65.40, date: "Yesterday", time: "6:45 PM", category: "Transport", icon: "⛽", account: "Everyday" },
    { id: "5", description: "Transfer to Savings", amount: -500.00, date: "Yesterday", time: "5:00 PM", category: "Transfer", icon: "💰", account: "Everyday" },
    { id: "6", description: "Transfer from Everyday", amount: 500.00, date: "Yesterday", time: "5:00 PM", category: "Transfer", icon: "💰", account: "Savings" },
  ],
  "Monday, 16 Dec": [
    { id: "7", description: "Uber Eats", amount: -34.50, date: "Monday, 16 Dec", time: "7:30 PM", category: "Food & Drink", icon: "🍔", account: "Everyday" },
    { id: "8", description: "JB Hi-Fi", amount: -299.00, date: "Monday, 16 Dec", time: "2:15 PM", category: "Shopping", icon: "🛍️", account: "Everyday" },
    { id: "9", description: "Round Up", amount: 0.50, date: "Monday, 16 Dec", time: "2:15 PM", category: "Savings", icon: "🔄", account: "Holiday Saver" },
  ],
  "Sunday, 15 Dec": [
    { id: "10", description: "Coles", amount: -156.78, date: "Sunday, 15 Dec", time: "11:20 AM", category: "Groceries", icon: "🛒", account: "Everyday" },
    { id: "11", description: "Bunnings", amount: -89.95, date: "Sunday, 15 Dec", time: "10:00 AM", category: "Home", icon: "🏠", account: "Everyday" },
  ],
  "Saturday, 14 Dec": [
    { id: "12", description: "The Coffee Club", amount: -24.50, date: "Saturday, 14 Dec", time: "9:30 AM", category: "Food & Drink", icon: "☕", account: "Everyday" },
    { id: "13", description: "Spotify", amount: -12.99, date: "Saturday, 14 Dec", time: "12:00 AM", category: "Entertainment", icon: "🎵", account: "Bills" },
  ],
};

const CATEGORIES = [
  { id: "all", label: "All", icon: "📋" },
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "transport", label: "Transport", icon: "🚗" },
  { id: "food", label: "Food & Drink", icon: "🍔" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "income", label: "Income", icon: "💼" },
];

// ============================================
// COMPONENTS
// ============================================

function SearchBar() {
  return (
    <div className="px-6 py-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <Input 
          placeholder="Search transactions..."
          className="pl-12 h-12 bg-slate-900 border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:border-coral-500"
        />
      </div>
    </div>
  );
}

function CategoryFilter() {
  const [selected, setSelected] = useState("all");
  
  return (
    <div className="px-6 pb-4">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              selected === cat.id
                ? "bg-coral-500 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <span>{cat.icon}</span>
            <span className="text-sm font-medium">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isPositive = transaction.amount > 0;
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      className="py-4 cursor-pointer hover:bg-slate-800/30 -mx-4 px-4 rounded-lg transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl">
          {transaction.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{transaction.description}</p>
          <p className="text-sm text-slate-500">{transaction.time} · {transaction.account}</p>
        </div>
        <div className="text-right">
          <p className={`font-semibold text-lg ${isPositive ? "text-emerald-400" : "text-white"}`}>
            {isPositive ? "+" : "-"}${Math.abs(transaction.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Category</span>
            <span className="text-white">{transaction.category}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Account</span>
            <span className="text-white">{transaction.account}</span>
          </div>
          {transaction.reference && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Reference</span>
              <span className="text-white font-mono text-xs">{transaction.reference}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Transaction ID</span>
            <span className="text-slate-400 font-mono text-xs">{transaction.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionGroup({ date, transactions }: { date: string; transactions: Transaction[] }) {
  return (
    <div className="px-6 mb-6">
      <h3 className="text-sm font-medium text-slate-500 mb-2 sticky top-14 bg-slate-950 py-2 -mx-6 px-6 z-10">
        {date}
      </h3>
      <div className="divide-y divide-slate-800/50">
        {transactions.map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  );
}

function ExportButton() {
  return (
    <div className="px-6 pb-6">
      <Button 
        variant="outline" 
        className="w-full h-12 border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl"
      >
        <Download className="w-5 h-5 mr-2" />
        Export Transactions
      </Button>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ActivityPage() {
  return (
    <MemberPortalLayout title="Activity" showBack>
      <SearchBar />
      <CategoryFilter />
      
      {Object.entries(TRANSACTIONS).map(([date, txs]) => (
        <TransactionGroup key={date} date={date} transactions={txs} />
      ))}
      
      <ExportButton />
    </MemberPortalLayout>
  );
}
