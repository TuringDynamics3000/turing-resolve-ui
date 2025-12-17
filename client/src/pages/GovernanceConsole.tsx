import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Users, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Search,
  RefreshCw,
  ChevronRight,
  Lock,
  Unlock,
  Eye,
  UserCheck,
  FileText,
  Activity,
  Zap
} from "lucide-react";

// Mock data for demonstration
const MOCK_ROLES = [
  { roleCode: "PLATFORM_ENGINEER", category: "PLATFORM", description: "Core platform engineer - system operations", assignedCount: 3 },
  { roleCode: "PLATFORM_ADMIN", category: "PLATFORM", description: "Platform administrator - token issuance", assignedCount: 2 },
  { roleCode: "PLATFORM_AUDITOR", category: "PLATFORM", description: "Platform auditor - read-only access", assignedCount: 1 },
  { roleCode: "RISK_APPROVER", category: "GOVERNANCE", description: "Risk approval authority", assignedCount: 4 },
  { roleCode: "COMPLIANCE_APPROVER", category: "GOVERNANCE", description: "Compliance approval authority", assignedCount: 2 },
  { roleCode: "MODEL_RISK_OFFICER", category: "GOVERNANCE", description: "Model risk oversight", assignedCount: 1 },
  { roleCode: "MODEL_AUTHOR", category: "ML", description: "Model author - register versions", assignedCount: 5 },
  { roleCode: "MODEL_OPERATOR", category: "ML", description: "Model operator - shadow deployments", assignedCount: 3 },
  { roleCode: "MODEL_APPROVER", category: "ML", description: "Model approver - promotions", assignedCount: 2 },
  { roleCode: "OPS_AGENT", category: "OPERATIONS", description: "Operations agent", assignedCount: 12 },
  { roleCode: "OPS_SUPERVISOR", category: "OPERATIONS", description: "Operations supervisor", assignedCount: 4 },
];

const MOCK_PENDING_PROPOSALS = [
  {
    proposalId: "prop-001",
    commandCode: "PROMOTE_MODEL_TO_PROD",
    resourceId: "credit-risk-v2.3.0",
    proposedBy: "alice@turingdynamics.com",
    proposedRole: "MODEL_APPROVER",
    status: "PENDING",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    requiredApprovers: ["RISK_APPROVER"],
    currentApprovals: [],
  },
  {
    proposalId: "prop-002",
    commandCode: "UPDATE_POLICY_DSL",
    resourceId: "lending-policy-v4",
    proposedBy: "bob@turingdynamics.com",
    proposedRole: "COMPLIANCE_APPROVER",
    status: "PENDING",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    requiredApprovers: ["COMPLIANCE_APPROVER"],
    currentApprovals: [],
  },
  {
    proposalId: "prop-003",
    commandCode: "MODIFY_TERMS",
    resourceId: "LOAN-2024-00847",
    proposedBy: "carol@turingdynamics.com",
    proposedRole: "OPS_SUPERVISOR",
    status: "PENDING",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    requiredApprovers: ["RISK_APPROVER"],
    currentApprovals: ["RISK_APPROVER"],
  },
];

const MOCK_AUTHORITY_FACTS = [
  {
    authorityFactId: "auth-001",
    actorId: "alice@turingdynamics.com",
    actorRole: "MODEL_APPROVER",
    commandCode: "PROMOTE_MODEL_TO_CANARY",
    resourceId: "fraud-detection-v1.2.0",
    decision: "ALLOW",
    reasonCode: "AUTHORIZED",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    authorityFactId: "auth-002",
    actorId: "dave@turingdynamics.com",
    actorRole: "MODEL_AUTHOR",
    commandCode: "PROMOTE_MODEL_TO_PROD",
    resourceId: "credit-risk-v2.2.0",
    decision: "DENY",
    reasonCode: "ROLE_MISSING",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    authorityFactId: "auth-003",
    actorId: "eve@turingdynamics.com",
    actorRole: "OPS_AGENT",
    commandCode: "ADJUST_BALANCE",
    resourceId: "ACC-001234",
    decision: "DENY",
    reasonCode: "FORBIDDEN_COMMAND",
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    authorityFactId: "auth-004",
    actorId: "frank@turingdynamics.com",
    actorRole: "OPS_SUPERVISOR",
    commandCode: "REVERSE_PAYMENT",
    resourceId: "PAY-2024-98765",
    decision: "ALLOW",
    reasonCode: "AUTHORIZED",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    authorityFactId: "auth-005",
    actorId: "grace@turingdynamics.com",
    actorRole: "MODEL_OPERATOR",
    commandCode: "PROMOTE_MODEL_TO_CANARY",
    resourceId: "exposure-limit-v1.1.0",
    decision: "DENY",
    reasonCode: "APPROVAL_REQUIRED",
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

const MOCK_STATS = {
  totalDecisions: 1247,
  allowedCount: 1089,
  deniedCount: 158,
  pendingApprovals: 3,
  activeRoleAssignments: 39,
};

function getCategoryColor(category: string) {
  switch (category) {
    case "PLATFORM": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "GOVERNANCE": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "ML": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "OPERATIONS": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "CUSTOMER": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

function getDecisionColor(decision: string) {
  return decision === "ALLOW" 
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";
}

function getReasonIcon(reasonCode: string) {
  switch (reasonCode) {
    case "AUTHORIZED": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "ROLE_MISSING": return <Lock className="h-4 w-4 text-red-400" />;
    case "FORBIDDEN_COMMAND": return <AlertTriangle className="h-4 w-4 text-red-400" />;
    case "APPROVAL_REQUIRED": return <Clock className="h-4 w-4 text-amber-400" />;
    default: return <XCircle className="h-4 w-4 text-zinc-400" />;
  }
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function GovernanceConsole() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("all");
  
  // Seed RBAC mutation
  const seedRbacMutation = trpc.rbac.seedRbacData.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'RBAC data seeded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to seed RBAC data: ${error.message}`);
    },
  });

  const filteredFacts = MOCK_AUTHORITY_FACTS.filter(fact => {
    if (decisionFilter !== "all" && fact.decision !== decisionFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        fact.actorId.toLowerCase().includes(query) ||
        fact.commandCode.toLowerCase().includes(query) ||
        fact.resourceId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                <Shield className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Governance Console
                </h1>
                <p className="text-zinc-400 text-sm">RBAC & Authority Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Activity className="h-3 w-3 mr-1" />
                System Healthy
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                onClick={async () => {
                  try {
                    await seedRbacMutation.mutateAsync();
                  } catch (e) {
                    // Error handled by mutation
                  }
                }}
                disabled={seedRbacMutation.isPending}
              >
                {seedRbacMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Seed RBAC Data
              </Button>
              <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Decisions</p>
                  <p className="text-2xl font-bold text-zinc-100">{MOCK_STATS.totalDecisions.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-800">
                  <FileCheck className="h-5 w-5 text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Allowed</p>
                  <p className="text-2xl font-bold text-emerald-400">{MOCK_STATS.allowedCount.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Denied</p>
                  <p className="text-2xl font-bold text-red-400">{MOCK_STATS.deniedCount.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-2xl font-bold text-amber-400">{MOCK_STATS.pendingApprovals}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Active Assignments</p>
                  <p className="text-2xl font-bold text-cyan-400">{MOCK_STATS.activeRoleAssignments}</p>
                </div>
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Users className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-zinc-800">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="roles" className="data-[state=active]:bg-zinc-800">
              <Users className="h-4 w-4 mr-2" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="approvals" className="data-[state=active]:bg-zinc-800">
              <FileCheck className="h-4 w-4 mr-2" />
              Pending Approvals
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-zinc-800">
              <Eye className="h-4 w-4 mr-2" />
              Authority Audit
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Recent Authority Decisions */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" />
                    Recent Authority Decisions
                  </CardTitle>
                  <CardDescription>Last 5 authorization attempts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_AUTHORITY_FACTS.slice(0, 5).map((fact) => (
                    <div key={fact.authorityFactId} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center gap-3">
                        {getReasonIcon(fact.reasonCode)}
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{fact.commandCode}</p>
                          <p className="text-xs text-zinc-500">{fact.actorId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getDecisionColor(fact.decision)}>
                          {fact.decision}
                        </Badge>
                        <span className="text-xs text-zinc-500">{formatTimeAgo(fact.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Pending Approvals Summary */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-400" />
                    Pending Approvals
                  </CardTitle>
                  <CardDescription>Commands awaiting maker/checker approval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_PENDING_PROPOSALS.map((proposal) => (
                    <div key={proposal.proposalId} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-zinc-200">{proposal.commandCode}</p>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {proposal.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 mb-2">Resource: {proposal.resourceId}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500">By: {proposal.proposedBy}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Role Distribution */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Role Distribution
                </CardTitle>
                <CardDescription>Active role assignments by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {["PLATFORM", "GOVERNANCE", "ML", "OPERATIONS", "CUSTOMER"].map((category) => {
                    const roles = MOCK_ROLES.filter(r => r.category === category);
                    const totalAssigned = roles.reduce((sum, r) => sum + r.assignedCount, 0);
                    return (
                      <div key={category} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                        <Badge variant="outline" className={`${getCategoryColor(category)} mb-2`}>
                          {category}
                        </Badge>
                        <p className="text-2xl font-bold text-zinc-100">{totalAssigned}</p>
                        <p className="text-xs text-zinc-500">{roles.length} roles</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Role Registry</CardTitle>
                    <CardDescription>Canonical RBAC role definitions</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="border-zinc-700">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MOCK_ROLES.map((role) => (
                    <div key={role.roleCode} className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={getCategoryColor(role.category)}>
                          {role.category}
                        </Badge>
                        <div>
                          <p className="font-mono text-sm font-medium text-zinc-200">{role.roleCode}</p>
                          <p className="text-xs text-zinc-500">{role.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-zinc-300">{role.assignedCount}</p>
                          <p className="text-xs text-zinc-500">assigned</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Maker/Checker Queue</CardTitle>
                    <CardDescription>Commands requiring approval before execution</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                    {MOCK_PENDING_PROPOSALS.length} pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MOCK_PENDING_PROPOSALS.map((proposal) => (
                    <div key={proposal.proposalId} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-mono text-sm font-medium text-amber-400">{proposal.commandCode}</p>
                            <Badge variant="outline" className="bg-zinc-700/50 text-zinc-300 border-zinc-600">
                              {proposal.proposalId}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-400">Resource: <span className="text-zinc-300">{proposal.resourceId}</span></p>
                        </div>
                        <span className="text-xs text-zinc-500">{formatTimeAgo(proposal.createdAt)}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 mb-3 text-xs">
                        <div className="flex items-center gap-1 text-zinc-500">
                          <Users className="h-3 w-3" />
                          Proposed by: <span className="text-zinc-300">{proposal.proposedBy}</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-500">
                          <Shield className="h-3 w-3" />
                          Role: <span className="text-zinc-300">{proposal.proposedRole}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Required approvals:</span>
                          {proposal.requiredApprovers.map((role) => (
                            <Badge 
                              key={role} 
                              variant="outline" 
                              className={proposal.currentApprovals.includes(role) 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                                : "bg-zinc-700/50 text-zinc-400 border-zinc-600"
                              }
                            >
                              {proposal.currentApprovals.includes(role) && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {role}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authority Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Authority Facts Explorer</CardTitle>
                    <CardDescription>Append-only audit log of all authorization decisions</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input 
                        placeholder="Search actor, command, resource..." 
                        className="pl-9 w-64 bg-zinc-800 border-zinc-700"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                      <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="ALLOW">Allowed</SelectItem>
                        <SelectItem value="DENY">Denied</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="border-zinc-700">
                      <FileText className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredFacts.map((fact) => (
                    <div key={fact.authorityFactId} className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors">
                      <div className="flex items-center gap-4">
                        {getReasonIcon(fact.reasonCode)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-mono text-sm font-medium text-zinc-200">{fact.commandCode}</p>
                            <Badge variant="outline" className={getDecisionColor(fact.decision)}>
                              {fact.decision}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {fact.actorId} ({fact.actorRole}) → {fact.resourceId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-medium text-zinc-400">{fact.reasonCode}</p>
                          <p className="text-xs text-zinc-500">{formatTimeAgo(fact.createdAt)}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
