import { useState } from "react";
import { Link } from "wouter";
import { 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft,
  Sparkles,
  TrendingUp,
  CreditCard,
  Building2,
  PiggyBank,
  Target,
  Plus
} from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

interface Account {
  id: string;
  name: string;
  type: "everyday" | "savings" | "loan" | "term";
  balance: number;
  available?: number;
  icon: React.ElementType;
  color: string;
}

interface Saver {
  id: string;
  name: string;
  emoji: string;
  current: number;
  target: number;
  color: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  icon?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MEMBER = {
  name: "Sarah",
  memberId: "CU-2847291",
  memberSince: "2019",
};

const ACCOUNTS: Account[] = [
  { id: "1", name: "Everyday", type: "everyday", balance: 2847.52, available: 2847.52, icon: CreditCard, color: "coral" },
  { id: "2", name: "Bills", type: "everyday", balance: 1250.00, available: 1250.00, icon: Building2, color: "blue" },
  { id: "3", name: "Savings", type: "savings", balance: 15420.87, icon: PiggyBank, color: "emerald" },
  { id: "4", name: "Term Deposit", type: "term", balance: 25000.00, icon: TrendingUp, color: "purple" },
];

const SAVERS: Saver[] = [
  { id: "1", name: "Holiday", emoji: "🏖️", current: 2850, target: 5000, color: "coral" },
  { id: "2", name: "New Car", emoji: "🚗", current: 8500, target: 20000, color: "blue" },
  { id: "3", name: "Emergency", emoji: "🛡️", current: 4200, target: 10000, color: "emerald" },
];

const RECENT_TRANSACTIONS: Transaction[] = [
  { id: "1", description: "Woolworths", amount: -87.52, date: "Today", category: "Groceries", icon: "🛒" },
  { id: "2", description: "Salary - Acme Corp", amount: 4250.00, date: "Today", category: "Income", icon: "💼" },
  { id: "3", description: "Netflix", amount: -22.99, date: "Yesterday", category: "Entertainment", icon: "📺" },
  { id: "4", description: "Shell Coles Express", amount: -65.40, date: "Yesterday", category: "Transport", icon: "⛽" },
];

// ============================================
// COMPONENTS
// ============================================

function TotalBalanceHero() {
  const totalBalance = ACCOUNTS.reduce((sum, acc) => sum + acc.balance, 0);
  
  return (
    <div className="px-6 pt-8 pb-6">
      <p className="text-slate-400 text-sm mb-1">Total Balance</p>
      <h1 className="text-5xl font-bold text-white tracking-tight">
        ${totalBalance.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
      </h1>
      <div className="flex items-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
          <TrendingUp className="w-3 h-3" />
          +$847.20 this month
        </span>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="px-6 pb-6">
      <div className="flex gap-3">
        <Button className="flex-1 bg-coral-500 hover:bg-coral-600 text-white h-12 rounded-xl font-medium">
          <ArrowUpRight className="w-5 h-5 mr-2" />
          Transfer
        </Button>
        <Button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white h-12 rounded-xl font-medium border border-slate-700">
          <ArrowDownLeft className="w-5 h-5 mr-2" />
          Request
        </Button>
      </div>
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const colorClasses: Record<string, string> = {
    coral: "from-coral-500 to-coral-600",
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    purple: "from-purple-500 to-purple-600",
  };
  
  return (
    <Link href={`/member/account/${account.id}`}>
      <a className="block p-4 bg-slate-900/80 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-all group">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[account.color]} flex items-center justify-center`}>
            <account.icon className="w-5 h-5 text-white" />
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
        <p className="text-slate-400 text-sm">{account.name}</p>
        <p className="text-xl font-semibold text-white mt-0.5">
          ${account.balance.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
        </p>
        {account.available !== undefined && account.available !== account.balance && (
          <p className="text-xs text-slate-500 mt-1">
            ${account.available.toLocaleString("en-AU", { minimumFractionDigits: 2 })} available
          </p>
        )}
      </a>
    </Link>
  );
}

function AccountsSection() {
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Accounts</h2>
        <Link href="/member/accounts">
          <a className="text-coral-400 text-sm font-medium hover:text-coral-300">View all</a>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNTS.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}

function SaverRing({ saver }: { saver: Saver }) {
  const progress = (saver.current / saver.target) * 100;
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  const colorClasses: Record<string, string> = {
    coral: "stroke-coral-500",
    blue: "stroke-blue-500",
    emerald: "stroke-emerald-500",
  };
  
  return (
    <Link href={`/member/saver/${saver.id}`}>
      <a className="flex flex-col items-center group">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-slate-800"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${colorClasses[saver.color]} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">{saver.emoji}</span>
          </div>
        </div>
        <p className="text-sm font-medium text-white mt-2 group-hover:text-coral-400 transition-colors">{saver.name}</p>
        <p className="text-xs text-slate-500">
          ${saver.current.toLocaleString()} / ${saver.target.toLocaleString()}
        </p>
      </a>
    </Link>
  );
}

function SaversSection() {
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-coral-400" />
          <h2 className="text-lg font-semibold text-white">Savers</h2>
        </div>
        <Link href="/member/savers">
          <a className="text-coral-400 text-sm font-medium hover:text-coral-300">View all</a>
        </Link>
      </div>
      <div className="flex items-center justify-around py-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
        {SAVERS.map((saver) => (
          <SaverRing key={saver.id} saver={saver} />
        ))}
        <button className="flex flex-col items-center group">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center group-hover:border-coral-500 transition-colors">
            <Plus className="w-6 h-6 text-slate-600 group-hover:text-coral-400 transition-colors" />
          </div>
          <p className="text-sm font-medium text-slate-500 mt-2 group-hover:text-coral-400 transition-colors">New</p>
        </button>
      </div>
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isPositive = transaction.amount > 0;
  
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg">
        {transaction.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{transaction.description}</p>
        <p className="text-sm text-slate-500">{transaction.category}</p>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${isPositive ? "text-emerald-400" : "text-white"}`}>
          {isPositive ? "+" : ""}${Math.abs(transaction.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-slate-500">{transaction.date}</p>
      </div>
    </div>
  );
}

function RecentActivitySection() {
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        <Link href="/member/activity">
          <a className="text-coral-400 text-sm font-medium hover:text-coral-300">View all</a>
        </Link>
      </div>
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 px-4 divide-y divide-slate-800/50">
        {RECENT_TRANSACTIONS.map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  );
}

function MemberGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  
  return (
    <div className="px-6 pt-4 flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm">{greeting},</p>
        <h2 className="text-2xl font-bold text-white">{MEMBER.name} 👋</h2>
      </div>
      <Link href="/member/profile">
        <a className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-500 to-orange-500 flex items-center justify-center text-white font-semibold text-lg">
          {MEMBER.name[0]}
        </a>
      </Link>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MemberDashboard() {
  return (
    <MemberPortalLayout>
      <MemberGreeting />
      <TotalBalanceHero />
      <QuickActions />
      <SaversSection />
      <AccountsSection />
      <RecentActivitySection />
    </MemberPortalLayout>
  );
}
