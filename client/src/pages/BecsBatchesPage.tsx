import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Download,
  RefreshCw,
  Send,
  Trash2,
  Eye,
  FileText,
  Plus,
  Calendar,
  DollarSign
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type BatchStatus = "DRAFT" | "PENDING" | "SUBMITTED" | "PROCESSING" | "SETTLED" | "FAILED" | "CANCELLED";
type SettlementCycle = "SAME_DAY" | "NEXT_DAY";

interface BatchTransaction {
  transactionId: string;
  amount: number;
  beneficiaryName: string;
  beneficiaryBsb: string;
  beneficiaryAccount: string;
  reference: string;
  status: "INCLUDED" | "EXCLUDED" | "FAILED";
}

interface BecsBatch {
  batchId: string;
  description: string;
  settlementCycle: SettlementCycle;
  processingDate: string;
  status: BatchStatus;
  transactions: BatchTransaction[];
  creditTotal: number;
  transactionCount: number;
  createdAt: string;
  submittedAt?: string;
  settledAt?: string;
}

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_BATCHES: BecsBatch[] = [
  {
    batchId: "BATCH-001",
    description: "December Payroll Week 2",
    settlementCycle: "NEXT_DAY",
    processingDate: "2024-12-19",
    status: "DRAFT",
    transactions: [
      { transactionId: "TX-001", amount: 5000.00, beneficiaryName: "JOHN SMITH", beneficiaryBsb: "062-000", beneficiaryAccount: "12345678", reference: "SALARY-DEC-W2", status: "INCLUDED" },
      { transactionId: "TX-002", amount: 4500.00, beneficiaryName: "JANE DOE", beneficiaryBsb: "063-001", beneficiaryAccount: "87654321", reference: "SALARY-DEC-W2", status: "INCLUDED" },
      { transactionId: "TX-003", amount: 6000.00, beneficiaryName: "BOB WILSON", beneficiaryBsb: "064-002", beneficiaryAccount: "11223344", reference: "SALARY-DEC-W2", status: "INCLUDED" },
    ],
    creditTotal: 15500.00,
    transactionCount: 3,
    createdAt: "2024-12-18T08:00:00Z",
  },
  {
    batchId: "BATCH-002",
    description: "Supplier Payments",
    settlementCycle: "SAME_DAY",
    processingDate: "2024-12-18",
    status: "SUBMITTED",
    transactions: [
      { transactionId: "TX-004", amount: 12500.00, beneficiaryName: "SUPPLIER CO PTY LTD", beneficiaryBsb: "065-003", beneficiaryAccount: "55667788", reference: "INV-2024-001", status: "INCLUDED" },
      { transactionId: "TX-005", amount: 8750.00, beneficiaryName: "MATERIALS INC", beneficiaryBsb: "066-004", beneficiaryAccount: "99887766", reference: "INV-2024-002", status: "INCLUDED" },
    ],
    creditTotal: 21250.00,
    transactionCount: 2,
    createdAt: "2024-12-18T06:00:00Z",
    submittedAt: "2024-12-18T09:30:00Z",
  },
  {
    batchId: "BATCH-003",
    description: "November Refunds",
    settlementCycle: "NEXT_DAY",
    processingDate: "2024-12-17",
    status: "SETTLED",
    transactions: [
      { transactionId: "TX-006", amount: 250.00, beneficiaryName: "CUSTOMER A", beneficiaryBsb: "062-000", beneficiaryAccount: "44332211", reference: "REFUND-001", status: "INCLUDED" },
      { transactionId: "TX-007", amount: 175.50, beneficiaryName: "CUSTOMER B", beneficiaryBsb: "063-001", beneficiaryAccount: "22113344", reference: "REFUND-002", status: "INCLUDED" },
    ],
    creditTotal: 425.50,
    transactionCount: 2,
    createdAt: "2024-12-16T14:00:00Z",
    submittedAt: "2024-12-16T16:00:00Z",
    settledAt: "2024-12-17T09:00:00Z",
  },
];

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: BatchStatus }) {
  const config: Record<BatchStatus, { color: string; icon: React.ReactNode }> = {
    DRAFT: { color: "bg-slate-500/20 text-slate-400", icon: <FileText className="w-3 h-3" /> },
    PENDING: { color: "bg-amber-500/20 text-amber-400", icon: <Clock className="w-3 h-3" /> },
    SUBMITTED: { color: "bg-blue-500/20 text-blue-400", icon: <Send className="w-3 h-3" /> },
    PROCESSING: { color: "bg-purple-500/20 text-purple-400", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    SETTLED: { color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle className="w-3 h-3" /> },
    FAILED: { color: "bg-red-500/20 text-red-400", icon: <XCircle className="w-3 h-3" /> },
    CANCELLED: { color: "bg-slate-500/20 text-slate-400", icon: <XCircle className="w-3 h-3" /> },
  };

  const { color, icon } = config[status];

  return (
    <Badge className={`${color} gap-1 font-medium`}>
      {icon}
      {status}
    </Badge>
  );
}

function CycleBadge({ cycle }: { cycle: SettlementCycle }) {
  const config: Record<SettlementCycle, { color: string; label: string }> = {
    SAME_DAY: { color: "bg-cyan-500/20 text-cyan-400", label: "Same Day" },
    NEXT_DAY: { color: "bg-indigo-500/20 text-indigo-400", label: "Next Day" },
  };

  const { color, label } = config[cycle];

  return (
    <Badge className={`${color} font-medium`}>
      {label}
    </Badge>
  );
}

function BatchCard({ batch, onView, onSubmit, onDownload, onDelete }: {
  batch: BecsBatch;
  onView: () => void;
  onSubmit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isDraft = batch.status === "DRAFT";

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-sm text-slate-400">{batch.batchId}</span>
            </div>
            <h3 className="font-medium text-slate-200">{batch.description}</h3>
          </div>
          <StatusBadge status={batch.status} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <p className="text-slate-500">Transactions</p>
            <p className="font-medium text-slate-200">{batch.transactionCount}</p>
          </div>
          <div>
            <p className="text-slate-500">Total</p>
            <p className="font-medium text-emerald-400">
              ${batch.creditTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Settlement</p>
            <CycleBadge cycle={batch.settlementCycle} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>Processing: {batch.processingDate}</span>
          <span>Created: {new Date(batch.createdAt).toLocaleDateString("en-AU")}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView} className="flex-1 border-slate-700">
            <Eye className="w-3 h-3 mr-1" />
            View
          </Button>
          
          {isDraft && (
            <>
              <Button size="sm" onClick={onSubmit} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                <Send className="w-3 h-3 mr-1" />
                Submit
              </Button>
              <Button variant="outline" size="icon" onClick={onDelete} className="border-slate-700 text-red-400 hover:text-red-300">
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
          
          {batch.status === "SUBMITTED" || batch.status === "SETTLED" ? (
            <Button variant="outline" size="sm" onClick={onDownload} className="border-slate-700">
              <Download className="w-3 h-3 mr-1" />
              ABA File
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BatchDetails({ batch, onClose }: { batch: BecsBatch; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Batch ID</p>
          <p className="font-mono text-lg">{batch.batchId}</p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-emerald-400">
            ${batch.creditTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Transactions</p>
          <p className="text-2xl font-bold text-slate-200">{batch.transactionCount}</p>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg">
        <p className="text-sm text-slate-500 mb-2">Description</p>
        <p className="text-slate-200">{batch.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Settlement Cycle</p>
          <CycleBadge cycle={batch.settlementCycle} />
        </div>
        <div>
          <p className="text-slate-500">Processing Date</p>
          <p className="text-slate-300">{batch.processingDate}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-3">Transactions</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {batch.transactions.map((tx) => (
            <div key={tx.transactionId} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-200">{tx.beneficiaryName}</p>
                <p className="text-xs text-slate-500 font-mono">
                  BSB: {tx.beneficiaryBsb} | Acc: {tx.beneficiaryAccount}
                </p>
                <p className="text-xs text-slate-400">{tx.reference}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-medium text-slate-200">
                  ${tx.amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </p>
                <Badge className={tx.status === "INCLUDED" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                  {tx.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Created</p>
          <p className="text-slate-300">{new Date(batch.createdAt).toLocaleString("en-AU")}</p>
        </div>
        {batch.submittedAt && (
          <div>
            <p className="text-slate-500">Submitted</p>
            <p className="text-slate-300">{new Date(batch.submittedAt).toLocaleString("en-AU")}</p>
          </div>
        )}
        {batch.settledAt && (
          <div>
            <p className="text-slate-500">Settled</p>
            <p className="text-slate-300">{new Date(batch.settledAt).toLocaleString("en-AU")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function BecsBatchesPage() {
  const [batches] = useState<BecsBatch[]>(SAMPLE_BATCHES);
  const [selectedBatch, setSelectedBatch] = useState<BecsBatch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredBatches = batches.filter((b) => {
    const matchesSearch = 
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "draft") return matchesSearch && b.status === "DRAFT";
    if (activeTab === "pending") return matchesSearch && ["PENDING", "SUBMITTED", "PROCESSING"].includes(b.status);
    if (activeTab === "settled") return matchesSearch && b.status === "SETTLED";
    
    return matchesSearch;
  });

  const handleSubmitBatch = (batch: BecsBatch) => {
    toast.success("Batch Submitted", {
      description: `${batch.batchId} has been submitted for processing.`,
    });
  };

  const handleDownloadAba = (batch: BecsBatch) => {
    toast.success("ABA File Downloaded", {
      description: `${batch.batchId}.aba has been downloaded.`,
    });
  };

  const handleDeleteBatch = (batch: BecsBatch) => {
    toast.success("Batch Deleted", {
      description: `${batch.batchId} has been deleted.`,
    });
  };

  // Stats
  const draftCount = batches.filter(b => b.status === "DRAFT").length;
  const pendingTotal = batches
    .filter(b => ["PENDING", "SUBMITTED", "PROCESSING"].includes(b.status))
    .reduce((sum, b) => sum + b.creditTotal, 0);
  const settledToday = batches
    .filter(b => b.status === "SETTLED" && b.settledAt?.startsWith("2024-12-17"))
    .reduce((sum, b) => sum + b.creditTotal, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">BECS Batch Management</h1>
            <p className="text-slate-500">Create and manage batch payment files</p>
          </div>

          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Draft Batches</p>
                  <p className="text-2xl font-bold text-slate-200">{draftCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending Settlement</p>
                  <p className="text-2xl font-bold text-amber-400">
                    ${pendingTotal.toLocaleString("en-AU", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Settled Today</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    ${settledToday.toLocaleString("en-AU", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Batches</p>
                  <p className="text-2xl font-bold text-slate-200">{batches.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Search */}
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="settled">Settled</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 bg-slate-800 border-slate-700"
              />
            </div>
            <Button variant="outline" size="icon" className="border-slate-700">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Batch Grid */}
        <div className="grid grid-cols-3 gap-4">
          {filteredBatches.map((batch) => (
            <BatchCard
              key={batch.batchId}
              batch={batch}
              onView={() => setSelectedBatch(batch)}
              onSubmit={() => handleSubmitBatch(batch)}
              onDownload={() => handleDownloadAba(batch)}
              onDelete={() => handleDeleteBatch(batch)}
            />
          ))}
        </div>

        {filteredBatches.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No batches found matching your criteria</p>
          </div>
        )}

        {/* Batch Details Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Batch Details</DialogTitle>
            </DialogHeader>
            {selectedBatch && <BatchDetails batch={selectedBatch} onClose={() => setSelectedBatch(null)} />}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
