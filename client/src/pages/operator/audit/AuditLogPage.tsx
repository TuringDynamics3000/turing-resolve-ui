import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download, Shield, User, Clock, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

/**
 * AuditLogPage - Operator audit log viewer
 * 
 * CRITICAL: This is a read-only view of append-only audit facts.
 * - Shows all operator actions (kill-switch, retry, reverse, advisory)
 * - Exportable for regulator reports
 * - Cannot be modified or deleted
 */

export function AuditLogPage() {
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const { data: auditFacts, isLoading, refetch } = trpc.audit.list.useQuery({
    actionType: actionTypeFilter !== "all" ? actionTypeFilter as any : undefined,
    targetType: targetTypeFilter !== "all" ? targetTypeFilter as any : undefined,
    limit,
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "KILL_SWITCH_ENABLE":
      case "KILL_SWITCH_DISABLE":
        return <Shield className="h-4 w-4" />;
      case "PAYMENT_RETRY":
      case "PAYMENT_REVERSE":
        return <RefreshCw className="h-4 w-4" />;
      case "ADVISORY_NOTE_ADDED":
        return <FileText className="h-4 w-4" />;
      case "INCIDENT_ANNOTATION":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case "KILL_SWITCH_ENABLE":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "KILL_SWITCH_DISABLE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "PAYMENT_RETRY":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "PAYMENT_REVERSE":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "ADVISORY_NOTE_ADDED":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "INCIDENT_ANNOTATION":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getResultIcon = (result: string) => {
    return result === "ACCEPTED" ? (
      <CheckCircle className="h-4 w-4 text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-red-400" />
    );
  };

  const handleExport = () => {
    if (!auditFacts) return;
    
    const csv = [
      ["Fact ID", "Actor", "Role", "Action", "Target Type", "Target ID", "Reason", "Result", "Occurred At"].join(","),
      ...auditFacts.map(f => [
        f.factId,
        f.actor,
        f.actorRole,
        f.actionType,
        f.targetType,
        f.targetId,
        `"${(f.reason || "").replace(/"/g, '""')}"`,
        f.result,
        f.occurredAt,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-slate-400 mt-1">
            Immutable record of all operator actions. Append-only, exportable for compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!auditFacts || auditFacts.length === 0}
            className="border-slate-700 hover:bg-slate-800"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Action Type</label>
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="KILL_SWITCH_ENABLE">Kill Switch Enable</SelectItem>
                  <SelectItem value="KILL_SWITCH_DISABLE">Kill Switch Disable</SelectItem>
                  <SelectItem value="PAYMENT_RETRY">Payment Retry</SelectItem>
                  <SelectItem value="PAYMENT_REVERSE">Payment Reverse</SelectItem>
                  <SelectItem value="ADVISORY_NOTE_ADDED">Advisory Note</SelectItem>
                  <SelectItem value="INCIDENT_ANNOTATION">Incident Annotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Target Type</label>
              <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Targets</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
                  <SelectItem value="ADAPTER">Adapter</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-400 mb-1 block">Limit</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                min={1}
                max={1000}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Facts Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            Audit Facts
          </CardTitle>
          <CardDescription>
            {auditFacts?.length || 0} records found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading audit log...</div>
          ) : !auditFacts || auditFacts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No audit facts recorded yet. Operator actions will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Occurred At</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Actor</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Action</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Target</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Reason</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditFacts.map((fact) => (
                    <tr key={fact.factId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span className="text-sm text-slate-300 font-mono">
                            {new Date(fact.occurredAt).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-500" />
                          <div>
                            <div className="text-sm text-white">{fact.actor}</div>
                            <div className="text-xs text-slate-500">{fact.actorRole}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${getActionBadgeColor(fact.actionType)} flex items-center gap-1 w-fit`}>
                          {getActionIcon(fact.actionType)}
                          {fact.actionType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-xs text-slate-500">{fact.targetType}</div>
                          <div className="text-sm text-cyan-400 font-mono">{fact.targetId}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300 max-w-xs truncate">
                          {fact.reason || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getResultIcon(fact.result)}
                          <span className={`text-sm ${fact.result === "ACCEPTED" ? "text-green-400" : "text-red-400"}`}>
                            {fact.result}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Notice */}
      <Card className="bg-amber-950/20 border-amber-800/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-300">Compliance Notice</div>
              <div className="text-sm text-amber-400/80 mt-1">
                This audit log is append-only and cannot be modified or deleted. All records are 
                cryptographically linked and exportable for regulatory compliance. Contact your 
                compliance officer for retention policies.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
