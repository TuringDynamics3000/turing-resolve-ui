import { useState } from "react";
import { 
  Shield, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ArrowUpRight,
  FileText
} from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ============================================
// TYPES
// ============================================

interface Limit {
  id: string;
  name: string;
  description: string;
  current: number;
  max: number;
  used: number;
  period: string;
  canRequest: boolean;
}

interface Request {
  id: string;
  limitName: string;
  requestedAmount: number;
  currentAmount: number;
  status: "pending" | "approved" | "declined";
  submittedAt: string;
  reason?: string;
  decisionAt?: string;
}

// ============================================
// MOCK DATA
// ============================================

const LIMITS: Limit[] = [
  { 
    id: "1", 
    name: "Daily Transfer", 
    description: "Maximum you can transfer per day",
    current: 5000, 
    max: 50000, 
    used: 1250, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "2", 
    name: "Daily Card Spend", 
    description: "Maximum card purchases per day",
    current: 3000, 
    max: 20000, 
    used: 450, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "3", 
    name: "ATM Withdrawal", 
    description: "Maximum ATM withdrawal per day",
    current: 1000, 
    max: 5000, 
    used: 0, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "4", 
    name: "International Transfer", 
    description: "Maximum international transfer per transaction",
    current: 2000, 
    max: 25000, 
    used: 0, 
    period: "per transaction",
    canRequest: true 
  },
  { 
    id: "5", 
    name: "BPAY", 
    description: "Maximum BPAY payment per day",
    current: 10000, 
    max: 50000, 
    used: 0, 
    period: "daily",
    canRequest: true 
  },
];

const REQUESTS: Request[] = [
  { 
    id: "1", 
    limitName: "Daily Transfer", 
    requestedAmount: 10000, 
    currentAmount: 5000,
    status: "pending", 
    submittedAt: "2 hours ago",
    reason: "Need to pay for car repairs"
  },
  { 
    id: "2", 
    limitName: "Daily Card Spend", 
    requestedAmount: 5000, 
    currentAmount: 3000,
    status: "approved", 
    submittedAt: "Dec 10",
    decisionAt: "Dec 11"
  },
  { 
    id: "3", 
    limitName: "International Transfer", 
    requestedAmount: 15000, 
    currentAmount: 2000,
    status: "declined", 
    submittedAt: "Nov 28",
    decisionAt: "Nov 29",
    reason: "Additional verification required"
  },
];

// ============================================
// COMPONENTS
// ============================================

function LimitCard({ limit }: { limit: Limit }) {
  const usagePercent = (limit.used / limit.current) * 100;
  const isNearLimit = usagePercent > 80;
  
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{limit.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{limit.description}</p>
        </div>
        {limit.canRequest && (
          <RequestIncreaseDialog limit={limit} />
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Current limit</span>
          <span className="text-white font-medium">${limit.current.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Used today</span>
          <span className={isNearLimit ? "text-amber-400" : "text-slate-300"}>
            ${limit.used.toLocaleString()}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              isNearLimit ? "bg-amber-500" : "bg-coral-500"
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-slate-500">
          <span>${limit.used.toLocaleString()} used</span>
          <span>${(limit.current - limit.used).toLocaleString()} remaining</span>
        </div>
      </div>
    </div>
  );
}

function RequestIncreaseDialog({ limit }: { limit: Limit }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-coral-400 hover:text-coral-300 hover:bg-coral-500/10">
          <ArrowUpRight className="w-4 h-4 mr-1" />
          Increase
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>Request Limit Increase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <p className="text-sm text-slate-400">Current {limit.name} limit</p>
            <p className="text-2xl font-bold text-white">${limit.current.toLocaleString()}</p>
          </div>
          
          <div>
            <Label className="text-slate-300">Requested new limit</Label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={limit.max.toLocaleString()}
                className="pl-8 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Maximum: ${limit.max.toLocaleString()}</p>
          </div>
          
          <div>
            <Label className="text-slate-300">Why do you need this increase?</Label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., I need to make a large purchase for..."
              className="mt-2 bg-slate-800 border-slate-700 text-white min-h-[100px]"
            />
          </div>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm text-blue-400 font-medium">Review process</p>
                <p className="text-xs text-slate-400 mt-1">
                  Your request will be reviewed by our team. Most requests are processed within 24 hours.
                </p>
              </div>
            </div>
          </div>
          
          <Button className="w-full bg-coral-500 hover:bg-coral-600 text-white rounded-xl h-12">
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestStatusBadge({ status }: { status: Request["status"] }) {
  const config = {
    pending: { icon: Clock, color: "text-amber-400 bg-amber-500/20", label: "Pending" },
    approved: { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/20", label: "Approved" },
    declined: { icon: XCircle, color: "text-red-400 bg-red-500/20", label: "Declined" },
  };
  
  const { icon: Icon, color, label } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function RequestCard({ request }: { request: Request }) {
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{request.limitName}</h3>
          <p className="text-sm text-slate-500">Submitted {request.submittedAt}</p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      
      <div className="flex items-center gap-2 text-sm mb-3">
        <span className="text-slate-400">${request.currentAmount.toLocaleString()}</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className="text-coral-400 font-medium">${request.requestedAmount.toLocaleString()}</span>
      </div>
      
      {request.reason && request.status === "declined" && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{request.reason}</p>
        </div>
      )}
      
      {request.status === "pending" && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Usually reviewed within 24 hours</span>
        </div>
      )}
    </div>
  );
}

function LimitsSection() {
  return (
    <div className="px-6 pb-6">
      <h2 className="text-lg font-semibold text-white mb-4">Your Limits</h2>
      <div className="space-y-4">
        {LIMITS.map((limit) => (
          <LimitCard key={limit.id} limit={limit} />
        ))}
      </div>
    </div>
  );
}

function RequestsSection() {
  const pendingCount = REQUESTS.filter(r => r.status === "pending").length;
  
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Your Requests</h2>
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>
      <div className="space-y-4">
        {REQUESTS.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function LimitsPage() {
  return (
    <MemberPortalLayout title="Limits" showBack>
      <div className="px-6 py-4">
        <div className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-800/50">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-coral-400" />
            <div>
              <h3 className="text-white font-medium">Account Limits</h3>
              <p className="text-sm text-slate-400 mt-1">
                Limits help protect your account. You can request temporary or permanent increases below.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <RequestsSection />
      <LimitsSection />
    </MemberPortalLayout>
  );
}
