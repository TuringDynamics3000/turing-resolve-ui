import { useState } from "react";
import { 
  Shield, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight,
  Link2,
  Lock,
  Hash,
  ExternalLink
} from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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

interface LimitRequest {
  id: string;
  decisionId: string;
  limitName: string;
  requestedAmount: number;
  currentAmount: number;
  status: "PENDING" | "APPROVED" | "DECLINED";
  submittedAt: Date;
  reason?: string;
  decisionAt?: Date;
  // Hash chain fields
  hash: string;
  previousHash: string | null;
  sequenceNumber: number;
  policyVersion: string;
}

// ============================================
// MOCK DATA (will be replaced with tRPC)
// ============================================

const LIMITS: Limit[] = [
  { 
    id: "LIM-001", 
    name: "Daily Transfer", 
    description: "Maximum you can transfer per day",
    current: 5000, 
    max: 50000, 
    used: 1250, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "LIM-002", 
    name: "Daily Card Spend", 
    description: "Maximum card purchases per day",
    current: 3000, 
    max: 20000, 
    used: 450, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "LIM-003", 
    name: "ATM Withdrawal", 
    description: "Maximum ATM withdrawal per day",
    current: 1000, 
    max: 5000, 
    used: 0, 
    period: "daily",
    canRequest: true 
  },
  { 
    id: "LIM-004", 
    name: "International Transfer", 
    description: "Maximum international transfer per transaction",
    current: 2000, 
    max: 25000, 
    used: 0, 
    period: "per transaction",
    canRequest: true 
  },
  { 
    id: "LIM-005", 
    name: "BPAY", 
    description: "Maximum BPAY payment per day",
    current: 10000, 
    max: 50000, 
    used: 0, 
    period: "daily",
    canRequest: true 
  },
];

const REQUESTS: LimitRequest[] = [
  { 
    id: "REQ-001", 
    decisionId: "DEC-004847",
    limitName: "Daily Transfer", 
    requestedAmount: 10000, 
    currentAmount: 5000,
    status: "PENDING", 
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    reason: "Need to pay for car repairs",
    hash: "7f3a8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    previousHash: "9e2d4f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e",
    sequenceNumber: 4847,
    policyVersion: "v2.1.0"
  },
  { 
    id: "REQ-002", 
    decisionId: "DEC-004823",
    limitName: "Daily Card Spend", 
    requestedAmount: 5000, 
    currentAmount: 3000,
    status: "APPROVED", 
    submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    decisionAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    hash: "2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b",
    previousHash: "1b3d5f7a9c1e3f5a7b9d1e3f5a7c9b1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b",
    sequenceNumber: 4823,
    policyVersion: "v2.1.0"
  },
  { 
    id: "REQ-003", 
    decisionId: "DEC-004801",
    limitName: "International Transfer", 
    requestedAmount: 15000, 
    currentAmount: 2000,
    status: "DECLINED", 
    submittedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    decisionAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    reason: "Additional verification required",
    hash: "5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d",
    previousHash: "4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c",
    sequenceNumber: 4801,
    policyVersion: "v2.0.5"
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// ============================================
// COMPONENTS
// ============================================

function HashChainBadge({ request }: { request: LimitRequest }) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors">
          <Lock className="w-3 h-3" />
          <span>Sealed</span>
        </button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            Cryptographic Proof
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-400">
            Your request is cryptographically sealed in an immutable chain. This proof guarantees your request cannot be altered or deleted.
          </p>
          
          <div className="space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Hash className="w-3.5 h-3.5" />
                Decision Hash
              </div>
              <code className="text-xs text-emerald-400 font-mono break-all">
                {request.hash}
              </code>
            </div>
            
            <div className="flex items-center justify-center">
              <Link2 className="w-4 h-4 text-slate-600 rotate-90" />
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Hash className="w-3.5 h-3.5" />
                Previous Hash
              </div>
              <code className="text-xs text-slate-400 font-mono break-all">
                {request.previousHash || "Genesis (first in chain)"}
              </code>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500">Sequence #</p>
              <p className="text-lg font-mono text-white">{request.sequenceNumber.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-500">Policy Version</p>
              <p className="text-lg font-mono text-white">{request.policyVersion}</p>
            </div>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-xs text-blue-400">
              <strong>What this means:</strong> Your request is part of decision #{request.sequenceNumber} in our governance chain. Every decision before and after yours is cryptographically linked, making any tampering mathematically detectable.
            </p>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() => {
              navigator.clipboard.writeText(request.hash);
              toast.success("Hash copied to clipboard");
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Copy Full Hash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  
  // tRPC mutation for creating decision
  const createDecision = trpc.ops.requestOverride.useMutation({
    onSuccess: (data) => {
      toast.success("Request submitted successfully", {
        description: `Decision ID: ${data.decisionId}`
      });
      setOpen(false);
      setAmount("");
      setReason("");
    },
    onError: (error) => {
      toast.error("Failed to submit request", {
        description: error.message
      });
    }
  });
  
  const handleSubmit = async () => {
    if (!amount || !reason) {
      toast.error("Please fill in all fields");
      return;
    }
    
    const requestedValue = parseFloat(amount);
    if (isNaN(requestedValue) || requestedValue <= limit.current) {
      toast.error("Requested amount must be greater than current limit");
      return;
    }
    
    if (requestedValue > limit.max) {
      toast.error(`Maximum allowed is $${limit.max.toLocaleString()}`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await createDecision.mutateAsync({
        limitId: limit.id,
        customerId: "CUS-MEMBER-001", // Would come from auth context
        requestedValue,
        justification: reason,
        expiresInDays: 7
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm text-emerald-400 font-medium">Cryptographically Sealed</p>
                <p className="text-xs text-slate-400 mt-1">
                  Your request will be recorded in our immutable decision chain. You'll receive a hash proof that guarantees your request cannot be altered.
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-coral-500 hover:bg-coral-600 text-white rounded-xl h-12"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestStatusBadge({ status }: { status: LimitRequest["status"] }) {
  const config = {
    PENDING: { icon: Clock, color: "text-amber-400 bg-amber-500/20", label: "Pending" },
    APPROVED: { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/20", label: "Approved" },
    DECLINED: { icon: XCircle, color: "text-red-400 bg-red-500/20", label: "Declined" },
  };
  
  const { icon: Icon, color, label } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function RequestCard({ request }: { request: LimitRequest }) {
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{request.limitName}</h3>
          <p className="text-sm text-slate-500">Submitted {formatDate(request.submittedAt)}</p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      
      <div className="flex items-center gap-2 text-sm mb-3">
        <span className="text-slate-400">${request.currentAmount.toLocaleString()}</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className="text-coral-400 font-medium">${request.requestedAmount.toLocaleString()}</span>
      </div>
      
      {/* Hash chain proof */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Hash className="w-3.5 h-3.5" />
          <span className="font-mono">{truncateHash(request.hash)}</span>
        </div>
        <HashChainBadge request={request} />
      </div>
      
      {request.reason && request.status === "DECLINED" && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{request.reason}</p>
        </div>
      )}
      
      {request.status === "PENDING" && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Usually reviewed within 24 hours</span>
        </div>
      )}
      
      {request.decisionAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Decided {formatDate(request.decisionAt)}</span>
        </div>
      )}
    </div>
  );
}

function TransparencyTimeline({ request }: { request: LimitRequest }) {
  const stages = [
    { 
      label: "Submitted", 
      time: request.submittedAt, 
      complete: true,
      hash: request.hash.slice(0, 8)
    },
    { 
      label: "Sealed", 
      time: request.submittedAt, 
      complete: true,
      hash: "Chain linked"
    },
    { 
      label: request.status === "PENDING" ? "Under Review" : "Decision Made", 
      time: request.decisionAt || null, 
      complete: request.status !== "PENDING",
      hash: request.status !== "PENDING" ? "Final" : null
    },
  ];
  
  return (
    <div className="p-4 bg-slate-800/30 rounded-xl">
      <h4 className="text-sm font-medium text-white mb-3">Request Timeline</h4>
      <div className="space-y-3">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 ${
              stage.complete ? "bg-emerald-400" : "bg-slate-600"
            }`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={stage.complete ? "text-white text-sm" : "text-slate-500 text-sm"}>
                  {stage.label}
                </span>
                {stage.time && (
                  <span className="text-xs text-slate-500">
                    {formatDate(stage.time)}
                  </span>
                )}
              </div>
              {stage.hash && (
                <span className="text-xs text-emerald-400/70 font-mono">{stage.hash}</span>
              )}
            </div>
          </div>
        ))}
      </div>
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
  const pendingCount = REQUESTS.filter(r => r.status === "PENDING").length;
  
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
      
      {/* Show timeline for first pending request */}
      {REQUESTS.filter(r => r.status === "PENDING").slice(0, 1).map(request => (
        <div key={`timeline-${request.id}`} className="mb-4">
          <TransparencyTimeline request={request} />
        </div>
      ))}
      
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
      
      {/* Governance guarantee banner */}
      <div className="px-6 pb-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-emerald-400">
              <strong>Governance Guarantee:</strong> All requests are cryptographically sealed and cannot be altered.
            </p>
          </div>
        </div>
      </div>
      
      <RequestsSection />
      <LimitsSection />
    </MemberPortalLayout>
  );
}
