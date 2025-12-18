import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Filter, 
  MessageSquare, 
  Plus, 
  Search, 
  User,
  XCircle,
  Shield,
  Activity,
  TrendingUp,
  AlertCircle,
  Eye,
  Link2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useOpsInboxWebSocket, CasePayload } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * Case Management - Central Exception Handling
 * 
 * This addresses the 🔴 Red gap: "Ops Inbox / Case management - Not built"
 * What "Green" Requires:
 * - Central exception handling
 * - Notes, approvals, evidence
 * - Governed override UI
 */

// Types
interface OpsCase {
  caseId: string;
  type: 'EXCEPTION' | 'REVIEW' | 'OVERRIDE' | 'ESCALATION' | 'INCIDENT';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  decisionId?: string;
  customerId?: string;
  customerName?: string;
  amount?: number;
  module: 'LENDING' | 'PAYMENTS' | 'DEPOSITS' | 'EXPOSURE' | 'ML' | 'GOVERNANCE';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  dueAt?: Date;
  notes: CaseNote[];
  approvals: CaseApproval[];
  evidencePackIds: string[];
  tags: string[];
}

interface CaseNote {
  noteId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  isInternal: boolean;
}

interface CaseApproval {
  approvalId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  decision: 'APPROVE' | 'REJECT' | 'PENDING';
  reason?: string;
  createdAt: Date;
}

// Mock data
const mockCases: OpsCase[] = [
  {
    caseId: 'CASE-2024-001',
    type: 'EXCEPTION',
    priority: 'CRITICAL',
    status: 'OPEN',
    title: 'Exposure limit breach - Customer AU-789456',
    description: 'Customer exposure exceeded 150k AUD limit during batch processing. Requires immediate review and potential override.',
    decisionId: 'dec_exposure_breach_001',
    customerId: 'AU-789456',
    customerName: 'Sarah Mitchell',
    amount: 165000,
    module: 'EXPOSURE',
    createdBy: 'system',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    notes: [
      {
        noteId: 'note_001',
        authorId: 'system',
        authorName: 'System',
        content: 'Auto-generated: Exposure limit LIMIT-AU-TOTAL-001 breached. Current exposure: $165,000. Limit: $150,000.',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        isInternal: false,
      }
    ],
    approvals: [],
    evidencePackIds: ['evp_exposure_001'],
    tags: ['exposure', 'limit-breach', 'auto-generated'],
  },
  {
    caseId: 'CASE-2024-002',
    type: 'REVIEW',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'ML model drift detected - credit-risk-v2',
    description: 'Feature drift score exceeded threshold (0.15 > 0.10). Model predictions may be unreliable.',
    module: 'ML',
    assignedTo: 'james.wilson',
    createdBy: 'ml-monitor',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    notes: [
      {
        noteId: 'note_002',
        authorId: 'james.wilson',
        authorName: 'James Wilson',
        content: 'Investigating drift source. Preliminary analysis suggests income feature distribution shift.',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        isInternal: true,
      }
    ],
    approvals: [],
    evidencePackIds: ['evp_ml_drift_001'],
    tags: ['ml', 'drift', 'model-risk'],
  },
  {
    caseId: 'CASE-2024-003',
    type: 'OVERRIDE',
    priority: 'MEDIUM',
    status: 'PENDING_APPROVAL',
    title: 'Manual override request - Loan approval',
    description: 'Request to override DECLINE decision for loan application. Customer has provided additional documentation.',
    decisionId: 'dec_loan_decline_045',
    customerId: 'AU-123789',
    customerName: 'Michael Chen',
    amount: 45000,
    module: 'LENDING',
    assignedTo: 'sarah.ops',
    createdBy: 'sarah.ops',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    notes: [
      {
        noteId: 'note_003',
        authorId: 'sarah.ops',
        authorName: 'Sarah Operations',
        content: 'Customer provided updated employment verification. Income now verified at $95,000 p.a.',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        isInternal: false,
      }
    ],
    approvals: [
      {
        approvalId: 'appr_001',
        approverId: 'risk.manager',
        approverName: 'Risk Manager',
        approverRole: 'RISK_APPROVER',
        decision: 'PENDING',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }
    ],
    evidencePackIds: ['evp_loan_045', 'evp_override_req_001'],
    tags: ['override', 'lending', 'pending-approval'],
  },
  {
    caseId: 'CASE-2024-004',
    type: 'ESCALATION',
    priority: 'HIGH',
    status: 'OPEN',
    title: 'Payment reversal dispute - $12,500',
    description: 'Customer disputing payment reversal. Claims unauthorized transaction was legitimate.',
    decisionId: 'dec_payment_rev_089',
    customerId: 'AU-456123',
    customerName: 'Emma Thompson',
    amount: 12500,
    module: 'PAYMENTS',
    createdBy: 'customer.service',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    notes: [],
    approvals: [],
    evidencePackIds: ['evp_payment_089'],
    tags: ['dispute', 'payments', 'customer-escalation'],
  },
  {
    caseId: 'CASE-2024-005',
    type: 'INCIDENT',
    priority: 'CRITICAL',
    status: 'RESOLVED',
    title: 'Merkle sealer delay - 15 minute gap',
    description: 'Merkle sealer experienced 15 minute delay due to database connection timeout. All events now sealed.',
    module: 'GOVERNANCE',
    assignedTo: 'platform.team',
    createdBy: 'monitoring',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
    notes: [
      {
        noteId: 'note_004',
        authorId: 'platform.team',
        authorName: 'Platform Team',
        content: 'Root cause: Connection pool exhaustion. Increased pool size from 10 to 25. Monitoring for recurrence.',
        createdAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
        isInternal: true,
      }
    ],
    approvals: [],
    evidencePackIds: [],
    tags: ['incident', 'infrastructure', 'resolved'],
  },
];

// Stats
const stats = {
  openCases: mockCases.filter(c => c.status === 'OPEN').length,
  inProgress: mockCases.filter(c => c.status === 'IN_PROGRESS').length,
  pendingApproval: mockCases.filter(c => c.status === 'PENDING_APPROVAL').length,
  resolvedToday: mockCases.filter(c => c.status === 'RESOLVED' && c.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
  criticalCount: mockCases.filter(c => c.priority === 'CRITICAL' && c.status !== 'RESOLVED' && c.status !== 'CLOSED').length,
  avgResolutionTime: '4.2h',
};

function getPriorityColor(priority: OpsCase['priority']) {
  switch (priority) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'LOW': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function getStatusColor(status: OpsCase['status']) {
  switch (status) {
    case 'OPEN': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'IN_PROGRESS': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'PENDING_APPROVAL': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'RESOLVED': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'CLOSED': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function getTypeIcon(type: OpsCase['type']) {
  switch (type) {
    case 'EXCEPTION': return <AlertTriangle className="w-4 h-4" />;
    case 'REVIEW': return <Eye className="w-4 h-4" />;
    case 'OVERRIDE': return <Shield className="w-4 h-4" />;
    case 'ESCALATION': return <TrendingUp className="w-4 h-4" />;
    case 'INCIDENT': return <AlertCircle className="w-4 h-4" />;
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CaseManagement() {
  const [selectedCase, setSelectedCase] = useState<OpsCase | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newNote, setNewNote] = useState('');
  const [newCaseCount, setNewCaseCount] = useState(0);

  // WebSocket integration for real-time updates
  const handleCaseUpdate = useCallback((cases: CasePayload[]) => {
    setNewCaseCount(prev => prev + cases.length);
    cases.forEach(c => {
      toast.info(`New case: ${c.title}`, {
        description: `Priority: ${c.priority} | Type: ${c.type}`,
      });
    });
  }, []);

  const { connectionState, clearNewCases } = useOpsInboxWebSocket(handleCaseUpdate);

  const filteredCases = mockCases.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ops-inbox">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Case Management</h1>
              {/* WebSocket connection status */}
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                connectionState === 'connected' ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400"
              )}>
                {connectionState === 'connected' ? (
                  <><Wifi className="w-3 h-3" /> Live</>
                ) : (
                  <><WifiOff className="w-3 h-3" /> Offline</>
                )}
              </span>
              {/* New cases indicator */}
              {newCaseCount > 0 && (
                <button
                  onClick={() => { setNewCaseCount(0); clearNewCases(); }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 animate-pulse hover:bg-red-500/30 transition-colors"
                >
                  {newCaseCount} new
                </button>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Central exception handling with notes, approvals, and evidence. {connectionState === 'connected' && 'Real-time updates enabled.'}
            </p>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Open</p>
                <p className="text-2xl font-bold text-blue-400">{stats.openCases}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-blue-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">In Progress</p>
                <p className="text-2xl font-bold text-purple-400">{stats.inProgress}</p>
              </div>
              <Activity className="w-8 h-8 text-purple-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-400">{stats.pendingApproval}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Resolved Today</p>
                <p className="text-2xl font-bold text-green-400">{stats.resolvedToday}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Critical</p>
                <p className="text-2xl font-bold text-red-400">{stats.criticalCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">Avg Resolution</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.avgResolutionTime}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-400/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Case List */}
        <div className="col-span-1">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL'].map(status => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                  >
                    {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCases.map(c => (
                <div
                  key={c.caseId}
                  onClick={() => setSelectedCase(c)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all",
                    selectedCase?.caseId === c.caseId
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card/30 border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("p-1 rounded", getPriorityColor(c.priority))}>
                        {getTypeIcon(c.type)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{c.caseId}</span>
                    </div>
                    <Badge className={cn("text-xs", getStatusColor(c.status))}>
                      {c.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium mb-1 line-clamp-2">{c.title}</h4>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.module}</span>
                    <span>{formatTimeAgo(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Case Detail */}
        <div className="col-span-2">
          {selectedCase ? (
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn("p-2 rounded-lg", getPriorityColor(selectedCase.priority))}>
                        {getTypeIcon(selectedCase.type)}
                      </span>
                      <div>
                        <CardTitle className="text-lg">{selectedCase.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span className="font-mono">{selectedCase.caseId}</span>
                          <span>•</span>
                          <Badge className={getStatusColor(selectedCase.status)}>
                            {selectedCase.status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge className={getPriorityColor(selectedCase.priority)}>
                            {selectedCase.priority}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <User className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                    <Button variant="outline" size="sm">
                      <Shield className="w-4 h-4 mr-1" />
                      Override
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="notes">Notes ({selectedCase.notes.length})</TabsTrigger>
                    <TabsTrigger value="approvals">Approvals ({selectedCase.approvals.length})</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence ({selectedCase.evidencePackIds.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                      <p>{selectedCase.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {selectedCase.customerId && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Customer</h4>
                          <p className="font-medium">{selectedCase.customerName}</p>
                          <p className="text-muted-foreground text-sm font-mono">{selectedCase.customerId}</p>
                        </div>
                      )}
                      {selectedCase.amount && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Amount</h4>
                          <p className="font-medium text-xl">
                            ${selectedCase.amount.toLocaleString()} AUD
                          </p>
                        </div>
                      )}
                      {selectedCase.decisionId && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Linked Decision</h4>
                          <div className="flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-primary" />
                            <Link href={`/decisions/${selectedCase.decisionId}`}>
                              <span className="text-primary font-mono text-sm hover:underline cursor-pointer">
                                {selectedCase.decisionId}
                              </span>
                            </Link>
                          </div>
                        </div>
                      )}
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Module</h4>
                        <Badge variant="secondary">{selectedCase.module}</Badge>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCase.tags.map(tag => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-4">
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {selectedCase.notes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No notes yet</p>
                        </div>
                      ) : (
                        selectedCase.notes.map(note => (
                          <div
                            key={note.noteId}
                            className={cn(
                              "p-4 rounded-lg border",
                              note.isInternal
                                ? 'bg-amber-500/5 border-amber-500/20'
                                : 'bg-muted/30 border-border/50'
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{note.authorName}</span>
                                {note.isInternal && (
                                  <Badge className="bg-amber-500/20 text-amber-400 text-xs">Internal</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatTimeAgo(note.createdAt)}</span>
                            </div>
                            <p className="text-muted-foreground">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline">
                        Add Internal Note
                      </Button>
                      <Button>
                        Add Note
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="approvals" className="space-y-4">
                    {selectedCase.approvals.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCase.approvals.map(approval => (
                          <div
                            key={approval.approvalId}
                            className="p-4 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-full",
                                  approval.decision === 'APPROVE' ? 'bg-green-500/20' :
                                  approval.decision === 'REJECT' ? 'bg-red-500/20' :
                                  'bg-amber-500/20'
                                )}>
                                  {approval.decision === 'APPROVE' ? (
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                  ) : approval.decision === 'REJECT' ? (
                                    <XCircle className="w-5 h-5 text-red-400" />
                                  ) : (
                                    <Clock className="w-5 h-5 text-amber-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{approval.approverName}</p>
                                  <p className="text-sm text-muted-foreground">{approval.approverRole}</p>
                                </div>
                              </div>
                              <Badge className={cn(
                                approval.decision === 'APPROVE' ? 'bg-green-500/20 text-green-400' :
                                approval.decision === 'REJECT' ? 'bg-red-500/20 text-red-400' :
                                'bg-amber-500/20 text-amber-400'
                              )}>
                                {approval.decision}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No approvals required for this case</p>
                      </div>
                    )}
                    {selectedCase.status === 'PENDING_APPROVAL' && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="text-red-400 hover:bg-red-500/10">
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="evidence" className="space-y-4">
                    {selectedCase.evidencePackIds.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCase.evidencePackIds.map(packId => (
                          <div
                            key={packId}
                            className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-primary" />
                              <div>
                                <p className="font-mono">{packId}</p>
                                <p className="text-sm text-muted-foreground">Evidence Pack</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No evidence packs linked to this case</p>
                      </div>
                    )}
                    <Button variant="outline" className="w-full">
                      <Link2 className="w-4 h-4 mr-2" />
                      Link Evidence Pack
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-panel h-full flex items-center justify-center">
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">Select a case</h3>
                <p className="text-sm">Choose a case from the list to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
