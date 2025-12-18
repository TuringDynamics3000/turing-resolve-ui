import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  FileText, 
  Download, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Building2,
  Calendar,
  RefreshCw,
  Eye
} from "lucide-react";

type APRAReportType = "ARF_720_0" | "ARF_720_1" | "ARF_720_2" | "ARF_720_3" | "ARF_720_4";

const REPORT_TYPES: { value: APRAReportType; label: string; description: string }[] = [
  { value: "ARF_720_0", label: "ARF 720.0", description: "Statement of Financial Position (Balance Sheet)" },
  { value: "ARF_720_1", label: "ARF 720.1", description: "Statement of Financial Performance (P&L)" },
  { value: "ARF_720_2", label: "ARF 720.2", description: "Capital Adequacy" },
  { value: "ARF_720_3", label: "ARF 720.3", description: "Liquidity Coverage Ratio" },
  { value: "ARF_720_4", label: "ARF 720.4", description: "Net Stable Funding Ratio" },
];

export default function APRAReporting() {
  const [selectedReportType, setSelectedReportType] = useState<APRAReportType>("ARF_720_0");
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  // Queries
  const { data: mappings } = trpc.gl.getAPRAMappings.useQuery({ reportType: selectedReportType });
  const { data: template } = trpc.gl.getAPRAReportTemplate.useQuery({ reportType: selectedReportType });
  const { data: reports, refetch: refetchReports } = trpc.gl.listAPRAReports.useQuery({});
  const { data: generatedReport } = trpc.gl.getAPRAReport.useQuery(
    { reportId: generatedReportId! },
    { enabled: !!generatedReportId }
  );

  // Mutations
  const generateReport = trpc.gl.generateAPRADemoReport.useMutation({
    onSuccess: (data) => {
      setGeneratedReportId(data.reportId);
      refetchReports();
      toast.success("Report generated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });

  const handleGenerateReport = () => {
    generateReport.mutate({
      reportType: selectedReportType,
      reportingPeriod: selectedPeriod,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Draft</Badge>;
      case "SUBMITTED":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Submitted</Badge>;
      case "ACCEPTED":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Accepted</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "ERROR":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "INFO":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-AU", { year: "numeric", month: "long" });
    return { value, label };
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-cyan-500" />
              APRA Regulatory Reporting
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate and submit prudential returns to the Australian Prudential Regulation Authority
            </p>
          </div>
        </div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="generate">Generate Report</TabsTrigger>
            <TabsTrigger value="mappings">GL Mappings</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>

          {/* Generate Report Tab */}
          <TabsContent value="generate" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Report Configuration */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Report Configuration</CardTitle>
                  <CardDescription>Select report type and period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Report Type</label>
                    <Select value={selectedReportType} onValueChange={(v) => setSelectedReportType(v as APRAReportType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{type.label}</span>
                              <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Reporting Period</label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map((period) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleGenerateReport} 
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                    disabled={generateReport.isPending}
                  >
                    {generateReport.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate Report
                  </Button>
                </CardContent>
              </Card>

              {/* Report Preview */}
              <Card className="bg-card border-border lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Report Preview
                  </CardTitle>
                  <CardDescription>
                    {generatedReport ? (
                      <span className="flex items-center gap-2">
                        {generatedReport.reportType} - {generatedReport.reportingPeriod}
                        {getStatusBadge(generatedReport.status)}
                      </span>
                    ) : (
                      "Generate a report to see preview"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {generatedReport ? (
                    <div className="space-y-4">
                      {/* Report Header */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-xs text-muted-foreground">Reporting Entity</span>
                          <p className="font-medium">{generatedReport.reportingEntity}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">ABN</span>
                          <p className="font-medium">{generatedReport.abn}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Generated At</span>
                          <p className="font-medium">{new Date(generatedReport.generatedAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Report ID</span>
                          <p className="font-mono text-sm">{generatedReport.reportId}</p>
                        </div>
                      </div>

                      {/* Line Items */}
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Line</th>
                              <th className="text-left p-3 font-medium">Description</th>
                              <th className="text-right p-3 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {generatedReport.lineItems.map((item: any, idx: number) => (
                              <tr key={idx} className="border-t border-border hover:bg-muted/30">
                                <td className="p-3 font-mono text-xs">{item.lineNumber}</td>
                                <td className="p-3">{item.description}</td>
                                <td className="p-3 text-right font-mono">{item.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      {generatedReport.totals && (
                        <div className="grid grid-cols-3 gap-4">
                          {generatedReport.totals.totalAssets && (
                            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                              <span className="text-xs text-muted-foreground">Total Assets</span>
                              <p className="text-lg font-bold text-green-500">{generatedReport.totals.totalAssets}</p>
                            </div>
                          )}
                          {generatedReport.totals.totalLiabilities && (
                            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                              <span className="text-xs text-muted-foreground">Total Liabilities</span>
                              <p className="text-lg font-bold text-red-500">{generatedReport.totals.totalLiabilities}</p>
                            </div>
                          )}
                          {generatedReport.totals.netAssets && (
                            <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                              <span className="text-xs text-muted-foreground">Net Assets</span>
                              <p className="text-lg font-bold text-cyan-500">{generatedReport.totals.netAssets}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Validation Issues */}
                      {generatedReport.validationIssues.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Validation Issues</h4>
                          {generatedReport.validationIssues.map((issue: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                              {getSeverityIcon(issue.severity)}
                              <div>
                                <span className="text-sm font-medium">{issue.code}</span>
                                <p className="text-sm text-muted-foreground">{issue.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t border-border">
                        <Button variant="outline" className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button 
                          className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                          disabled={generatedReport.validationIssues.some((i: any) => i.severity === "ERROR")}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Submit to APRA
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 opacity-50" />
                      <p>No report generated yet</p>
                      <p className="text-sm">Select a report type and period, then click Generate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GL Mappings Tab */}
          <TabsContent value="mappings">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">GL to APRA Mappings</CardTitle>
                <CardDescription>
                  How General Ledger accounts map to APRA report line items for {REPORT_TYPES.find(t => t.value === selectedReportType)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">GL Account</th>
                        <th className="text-left p-3 font-medium">GL Name</th>
                        <th className="text-left p-3 font-medium">APRA Line</th>
                        <th className="text-left p-3 font-medium">APRA Description</th>
                        <th className="text-center p-3 font-medium">Sign</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings?.map((mapping: any, idx: number) => (
                        <tr key={idx} className="border-t border-border hover:bg-muted/30">
                          <td className="p-3 font-mono">{mapping.glAccountCode}</td>
                          <td className="p-3">{mapping.glAccountName}</td>
                          <td className="p-3 font-mono">{mapping.apraLineNumber}</td>
                          <td className="p-3">{mapping.apraDescription}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={mapping.sign === "POSITIVE" ? "text-green-500" : "text-red-500"}>
                              {mapping.sign === "POSITIVE" ? "+" : "-"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report History Tab */}
          <TabsContent value="history">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Report History</span>
                  <Button variant="outline" size="sm" onClick={() => refetchReports()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </CardTitle>
                <CardDescription>Previously generated APRA reports</CardDescription>
              </CardHeader>
              <CardContent>
                {reports && reports.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Report ID</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Period</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Generated</th>
                          <th className="text-right p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report: any) => (
                          <tr key={report.reportId} className="border-t border-border hover:bg-muted/30">
                            <td className="p-3 font-mono text-xs">{report.reportId}</td>
                            <td className="p-3">{report.reportType}</td>
                            <td className="p-3">{report.reportingPeriod}</td>
                            <td className="p-3">{getStatusBadge(report.status)}</td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(report.generatedAt).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setGeneratedReportId(report.reportId)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4 opacity-50" />
                    <p>No reports generated yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
