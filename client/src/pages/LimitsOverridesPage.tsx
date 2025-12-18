import { useState } from "react";
import { OpsConsoleLayout } from "@/components/OpsConsoleLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  Shield, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  History,
  DollarSign,
  Gauge,
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ============================================
// COMPONENTS
// ============================================

function LimitCard({ 
  limit 
}: { 
  limit: {
    id: string;
    name: string;
    description: string;
    category: string;
    currentValue: number;
    maxValue: number;
    currency: string;
    scope: string;
    policyId: string;
    lastUpdated: Date;
  };
}) {
  const utilization = (limit.currentValue / limit.maxValue) * 100;
  const utilizationColor = utilization > 80 ? "text-red-400" : utilization > 60 ? "text-amber-400" : "text-emerald-400";
  const progressColor = utilization > 80 ? "bg-red-500" : utilization > 60 ? "bg-amber-500" : "bg-emerald-500";
  
  const categoryIcons = {
    TRANSACTION: DollarSign,
    DAILY: Clock,
    MONTHLY: TrendingUp,
    EXPOSURE: Gauge,
    VELOCITY: ArrowUpRight,
  };
  
  const CategoryIcon = categoryIcons[limit.category as keyof typeof categoryIcons] || Shield;
  
  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CategoryIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-100">{limit.name}</CardTitle>
              <CardDescription className="text-xs text-slate-500">{limit.description}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
            {limit.scope}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Values */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold text-slate-100">
                {limit.currency === 'AUD' ? '$' : ''}{limit.currentValue.toLocaleString()}
              </span>
              <span className="text-sm text-slate-500 ml-1">
                / {limit.currency === 'AUD' ? '$' : ''}{limit.maxValue.toLocaleString()}
              </span>
            </div>
            <span className={`text-sm font-medium ${utilizationColor}`}>
              {utilization.toFixed(0)}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${progressColor} transition-all`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono text-cyan-400">{limit.policyId}</span>
            <span>Updated {formatDistanceToNow(new Date(limit.lastUpdated), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverrideRequestCard({ 
  override,
  onApprove,
  onDecline
}: { 
  override: {
    id: string;
    limitId: string;
    limitName: string;
    customerId: string;
    customerName: string;
    requestedValue: number;
    currentValue: number;
    justification: string;
    status: string;
    requestedBy: string;
    requestedAt: Date;
    reviewedBy?: string;
    reviewedAt?: Date;
    expiresAt: Date;
    decisionId?: string;
  };
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  const statusColors = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    DECLINED: "bg-red-500/10 text-red-400 border-red-500/30",
    EXPIRED: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };
  
  const statusIcons = {
    PENDING: Clock,
    APPROVED: CheckCircle,
    DECLINED: XCircle,
    EXPIRED: AlertTriangle,
  };
  
  const StatusIcon = statusIcons[override.status as keyof typeof statusIcons] || Clock;
  const increasePercent = ((override.requestedValue - override.currentValue) / override.currentValue * 100).toFixed(0);
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`p-2 rounded-lg ${statusColors[override.status as keyof typeof statusColors]?.split(' ')[0] || 'bg-slate-800'}`}>
            <StatusIcon className={`w-5 h-5 ${statusColors[override.status as keyof typeof statusColors]?.split(' ')[1] || 'text-slate-400'}`} />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-slate-100">{override.customerName}</span>
              <Badge className={statusColors[override.status as keyof typeof statusColors]}>
                {override.status}
              </Badge>
            </div>
            
            <p className="text-sm text-slate-400 mb-2">{override.limitName}</p>
            
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-500">Current:</span>
                <span className="text-slate-300 ml-1">${override.currentValue.toLocaleString()}</span>
              </div>
              <span className="text-slate-600">→</span>
              <div>
                <span className="text-slate-500">Requested:</span>
                <span className="text-cyan-400 ml-1 font-medium">${override.requestedValue.toLocaleString()}</span>
                <span className="text-emerald-400 ml-1">(+{increasePercent}%)</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 mt-2 italic">"{override.justification}"</p>
            
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>Requested by {override.requestedBy}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(override.requestedAt), { addSuffix: true })}</span>
              {override.reviewedBy && (
                <>
                  <span>•</span>
                  <span>Reviewed by {override.reviewedBy}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Actions */}
          {override.status === 'PENDING' && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={onDecline}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Decline
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={onApprove}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RequestOverrideDialog({ limits }: { limits: { id: string; name: string; currentValue: number; maxValue: number; }[] }) {
  const [open, setOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<string>("");
  const [customerId, setCustomerId] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [justification, setJustification] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  
  const requestOverride = trpc.ops.requestOverride.useMutation({
    onSuccess: (result) => {
      toast.success('Override request submitted', {
        description: `Decision ID: ${result.decisionId}`,
      });
      setOpen(false);
      setSelectedLimit("");
      setCustomerId("");
      setRequestedValue("");
      setJustification("");
    },
    onError: (error) => {
      toast.error('Failed to submit override request', {
        description: error.message,
      });
    },
  });
  
  const handleSubmit = () => {
    if (!selectedLimit || !customerId || !requestedValue || !justification) {
      toast.error('Please fill in all fields');
      return;
    }
    
    requestOverride.mutate({
      limitId: selectedLimit,
      customerId,
      requestedValue: parseInt(requestedValue),
      justification,
      expiresInDays: parseInt(expiryDays),
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="w-4 h-4 mr-2" />
          Request Override
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Request Limit Override</DialogTitle>
          <DialogDescription className="text-slate-400">
            Submit a request to temporarily increase a customer's limit. This will create a decision for approval.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Limit Type</Label>
            <Select value={selectedLimit} onValueChange={setSelectedLimit}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select a limit" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {limits.map((limit) => (
                  <SelectItem key={limit.id} value={limit.id} className="text-slate-100">
                    {limit.name} (Current: ${limit.currentValue.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-300">Customer ID</Label>
            <Input 
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="CUS-000123"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-300">Requested Value ($)</Label>
            <Input 
              type="number"
              value={requestedValue}
              onChange={(e) => setRequestedValue(e.target.value)}
              placeholder="25000"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-300">Override Duration</Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="1" className="text-slate-100">1 day</SelectItem>
                <SelectItem value="7" className="text-slate-100">7 days</SelectItem>
                <SelectItem value="14" className="text-slate-100">14 days</SelectItem>
                <SelectItem value="30" className="text-slate-100">30 days</SelectItem>
                <SelectItem value="90" className="text-slate-100">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-300">Justification</Label>
            <Textarea 
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this override is needed..."
              className="bg-slate-800 border-slate-700 text-slate-100 min-h-[100px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-700 text-slate-300">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={requestOverride.isPending}
          >
            {requestOverride.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function LimitsOverridesPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  
  // Fetch limits
  const { data: limits, isLoading: limitsLoading, refetch: refetchLimits } = trpc.ops.getLimits.useQuery(
    categoryFilter ? { category: categoryFilter as any } : undefined
  );
  
  // Fetch override requests
  const { data: overrides, isLoading: overridesLoading, refetch: refetchOverrides } = trpc.ops.getOverrideRequests.useQuery();
  
  // Approve/Decline mutations
  const approveOverride = trpc.ops.approveOverride.useMutation({
    onSuccess: () => {
      toast.success('Override approved');
      refetchOverrides();
    },
    onError: (error) => {
      toast.error('Failed to approve override', { description: error.message });
    },
  });
  
  const declineOverride = trpc.ops.approveOverride.useMutation({
    onSuccess: () => {
      toast.success('Override declined');
      refetchOverrides();
    },
    onError: (error) => {
      toast.error('Failed to decline override', { description: error.message });
    },
  });
  
  const pendingOverrides = overrides?.filter(o => o.status === 'PENDING') || [];
  const completedOverrides = overrides?.filter(o => o.status !== 'PENDING') || [];
  
  const categories = ['TRANSACTION', 'DAILY', 'MONTHLY', 'EXPOSURE', 'VELOCITY'];
  
  return (
    <OpsConsoleLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Limits & Overrides</h1>
            <p className="text-slate-400 mt-1">Manage transaction limits and override requests</p>
          </div>
          <RequestOverrideDialog limits={limits || []} />
        </div>
        
        <Tabs defaultValue="catalogue" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="catalogue" className="data-[state=active]:bg-cyan-600">
              <Shield className="w-4 h-4 mr-2" />
              Limit Catalogue
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-cyan-600">
              <Clock className="w-4 h-4 mr-2" />
              Pending Overrides
              {pendingOverrides.length > 0 && (
                <Badge className="ml-2 bg-amber-500/20 text-amber-400">{pendingOverrides.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>
          
          {/* Limit Catalogue */}
          <TabsContent value="catalogue" className="space-y-4">
            {/* Category Filters */}
            <div className="flex items-center gap-2">
              <Button
                variant={!categoryFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(undefined)}
                className={!categoryFilter ? "bg-cyan-600" : "border-slate-700 text-slate-400"}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  className={categoryFilter === cat ? "bg-cyan-600" : "border-slate-700 text-slate-400"}
                >
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
            
            {/* Limits Grid */}
            {limitsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-40 bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {limits?.map((limit) => (
                  <LimitCard key={limit.id} limit={limit} />
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Pending Overrides */}
          <TabsContent value="pending" className="space-y-4">
            {overridesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 bg-slate-800" />
                ))}
              </div>
            ) : pendingOverrides.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No pending overrides</p>
                <p className="text-sm">All override requests have been processed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOverrides.map((override) => (
                  <OverrideRequestCard 
                    key={override.id} 
                    override={override}
                    onApprove={() => approveOverride.mutate({ overrideId: override.id, approved: true })}
                    onDecline={() => declineOverride.mutate({ overrideId: override.id, approved: false })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* History */}
          <TabsContent value="history" className="space-y-4">
            {overridesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 bg-slate-800" />
                ))}
              </div>
            ) : completedOverrides.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No override history</p>
                <p className="text-sm">Completed override requests will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedOverrides.map((override) => (
                  <OverrideRequestCard key={override.id} override={override} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </OpsConsoleLayout>
  );
}
