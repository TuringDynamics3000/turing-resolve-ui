import { useState } from "react";
import { ArrowRight, ChevronDown, Clock, Users, Building2, Repeat } from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================
// TYPES
// ============================================

interface Account {
  id: string;
  name: string;
  balance: number;
  bsb?: string;
  accountNumber?: string;
}

interface Payee {
  id: string;
  name: string;
  bsb: string;
  accountNumber: string;
  lastPaid?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MY_ACCOUNTS: Account[] = [
  { id: "1", name: "Everyday", balance: 2847.52, bsb: "802-985", accountNumber: "12345678" },
  { id: "2", name: "Bills", balance: 1250.00, bsb: "802-985", accountNumber: "12345679" },
  { id: "3", name: "Savings", balance: 15420.87, bsb: "802-985", accountNumber: "12345680" },
];

const RECENT_PAYEES: Payee[] = [
  { id: "1", name: "Mum", bsb: "063-000", accountNumber: "11223344", lastPaid: "2 days ago" },
  { id: "2", name: "James Smith", bsb: "082-001", accountNumber: "55667788", lastPaid: "1 week ago" },
  { id: "3", name: "AGL Energy", bsb: "013-000", accountNumber: "99887766", lastPaid: "Dec 1" },
];

// ============================================
// COMPONENTS
// ============================================

function TransferTypeSelector() {
  const [selected, setSelected] = useState("between");
  
  const types = [
    { id: "between", label: "Between accounts", icon: Repeat },
    { id: "someone", label: "To someone", icon: Users },
    { id: "bpay", label: "BPAY", icon: Building2 },
    { id: "scheduled", label: "Scheduled", icon: Clock },
  ];
  
  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-2 gap-3">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelected(type.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
              selected === type.id
                ? "bg-coral-500/10 border-coral-500/50 text-coral-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <type.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountSelector({ 
  label, 
  accounts, 
  selected, 
  onSelect 
}: { 
  label: string; 
  accounts: Account[]; 
  selected: Account | null;
  onSelect: (account: Account) => void;
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="space-y-2">
      <Label className="text-slate-400 text-sm">{label}</Label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
      >
        {selected ? (
          <div className="text-left">
            <p className="text-white font-medium">{selected.name}</p>
            <p className="text-sm text-slate-500">
              ${selected.balance.toLocaleString("en-AU", { minimumFractionDigits: 2 })} available
            </p>
          </div>
        ) : (
          <span className="text-slate-500">Select account</span>
        )}
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      
      {open && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                onSelect(account);
                setOpen(false);
              }}
              className={`w-full p-4 text-left hover:bg-slate-800 transition-colors ${
                selected?.id === account.id ? "bg-slate-800" : ""
              }`}
            >
              <p className="text-white font-medium">{account.name}</p>
              <p className="text-sm text-slate-500">
                ${account.balance.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AmountInput() {
  const [amount, setAmount] = useState("");
  
  return (
    <div className="space-y-2">
      <Label className="text-slate-400 text-sm">Amount</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-500">$</span>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="pl-10 h-16 text-3xl font-semibold bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 rounded-xl focus:border-coral-500"
        />
      </div>
    </div>
  );
}

function DescriptionInput() {
  return (
    <div className="space-y-2">
      <Label className="text-slate-400 text-sm">Description (optional)</Label>
      <Input
        placeholder="What's this for?"
        className="h-12 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 rounded-xl focus:border-coral-500"
      />
    </div>
  );
}

function RecentPayees() {
  return (
    <div className="px-6 py-4">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Recent payees</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6">
        {RECENT_PAYEES.map((payee) => (
          <button
            key={payee.id}
            className="flex flex-col items-center gap-2 min-w-[80px]"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-semibold text-lg">
              {payee.name.split(" ").map(n => n[0]).join("")}
            </div>
            <span className="text-sm text-white truncate max-w-[80px]">{payee.name}</span>
            <span className="text-xs text-slate-500">{payee.lastPaid}</span>
          </button>
        ))}
        <button className="flex flex-col items-center gap-2 min-w-[80px]">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:border-coral-500 hover:text-coral-400 transition-colors">
            <Users className="w-6 h-6" />
          </div>
          <span className="text-sm text-slate-500">New</span>
        </button>
      </div>
    </div>
  );
}

function TransferForm() {
  const [fromAccount, setFromAccount] = useState<Account | null>(MY_ACCOUNTS[0]);
  const [toAccount, setToAccount] = useState<Account | null>(null);
  
  return (
    <div className="px-6 space-y-6">
      <AccountSelector
        label="From"
        accounts={MY_ACCOUNTS}
        selected={fromAccount}
        onSelect={setFromAccount}
      />
      
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-coral-500 flex items-center justify-center">
          <ArrowRight className="w-5 h-5 text-white rotate-90" />
        </div>
      </div>
      
      <AccountSelector
        label="To"
        accounts={MY_ACCOUNTS.filter(a => a.id !== fromAccount?.id)}
        selected={toAccount}
        onSelect={setToAccount}
      />
      
      <AmountInput />
      
      <DescriptionInput />
      
      <Button className="w-full h-14 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-lg font-semibold">
        Transfer Money
      </Button>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function TransferPage() {
  return (
    <MemberPortalLayout title="Transfer" showBack>
      <TransferTypeSelector />
      <RecentPayees />
      <TransferForm />
      <div className="h-8" />
    </MemberPortalLayout>
  );
}
