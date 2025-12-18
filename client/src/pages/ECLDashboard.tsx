import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  DollarSign,
  PieChart,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";

// Sample portfolio data for demonstration
const SAMPLE_PORTFOLIO = [
  { assetId: "LOAN-001", assetType: "PERSONAL_LOAN", customerId: "CUST-001", customerName: "James Wilson", outstandingBalanceCents: 5000000, creditRating: "BBB", originationRating: "BBB", daysPastDue: 0, isForborne: false, isOnWatchlist: false },
  { assetId: "LOAN-002", assetType: "HOME_LOAN", customerId: "CUST-002", customerName: "Sarah Chen", outstandingBalanceCents: 45000000, creditRating: "A", originationRating: "A", daysPastDue: 0, isForborne: false, isOnWatchlist: false, collateralValueCents: 65000000, collateralType: "PROPERTY" },
  { assetId: "LOAN-003", assetType: "PERSONAL_LOAN", customerId: "CUST-003", customerName: "Michael Brown", outstandingBalanceCents: 2500000, creditRating: "BB", originationRating: "BBB", daysPastDue: 45, isForborne: false, isOnWatchlist: true },
  { assetId: "LOAN-004", assetType: "CREDIT_CARD", customerId: "CUST-004", customerName: "Emma Davis", outstandingBalanceCents: 1500000, creditRating: "BBB", originationRating: "BBB", daysPastDue: 0, isForborne: false, isOnWatchlist: false },
  { assetId: "LOAN-005", assetType: "PERSONAL_LOAN", customerId: "CUST-005", customerName: "David Thompson", outstandingBalanceCents: 3500000, creditRating: "CCC", originationRating: "BB", daysPastDue: 95, isForborne: true, isOnWatchlist: true },
  { assetId: "LOAN-006", assetType: "HOME_LOAN", customerId: "CUST-006", customerName: "Lisa Anderson", outstandingBalanceCents: 38000000, creditRating: "AA", originationRating: "AA", daysPastDue: 0, isForborne: false, isOnWatchlist: false, collateralValueCents: 55000000, collateralType: "PROPERTY" },
  { assetId: "LOAN-007", assetType: "BUSINESS_LOAN", customerId: "CUST-007", customerName: "Tech Startup Pty Ltd", outstandingBalanceCents: 25000000, creditRating: "BB", originationRating: "BBB", daysPastDue: 35, isForborne: false, isOnWatchlist: false },
  { assetId: "LOAN-008", assetType: "OVERDRAFT", customerId: "CUST-008", customerName: "Robert Martinez", outstandingBalanceCents: 800000, creditRating: "B", originationRating: "BB", daysPastDue: 60, isForborne: false, isOnWatchlist: true },
];

interface ECLResult {
  assetId: string;
  stage: string;
  stageReason: string;
  pd12Month: number;
  pdLifetime: number;
  lgd: number;
  ead: string;
  ecl12Month: string;
  eclLifetime: string;
  eclProvision: string;
  scenarioECLs: { scenarioId: string; weight: number; ecl: string }[];
}

interface AssetWithECL {
  asset: typeof SAMPLE_PORTFOLIO[0];
  ecl: ECLResult | null;
  loading: boolean;
}

export default function ECLDashboard() {
  const [assetsWithECL, setAssetsWithECL] = useState<AssetWithECL[]>(
    SAMPLE_PORTFOLIO.map(asset => ({ asset, ecl: null, loading: false }))
  );
  const [selectedAsset, setSelectedAsset] = useState<AssetWithECL | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateECLMutation = trpc.gl.calculateECL.useQuery;

  // Calculate ECL for all assets
  const calculateAllECL = async () => {
    setIsCalculating(true);
    
    // Simulate ECL calculation with realistic results
    const results = SAMPLE_PORTFOLIO.map(asset => {
      // Determine stage based on asset characteristics
      let stage = "STAGE_1";
      let stageReason = "Performing - no significant increase in credit risk";
      
      if (asset.daysPastDue >= 90 || asset.creditRating === "CCC" || asset.creditRating === "CC" || asset.creditRating === "C" || asset.creditRating === "D") {
        stage = "STAGE_3";
        stageReason = `Credit-impaired: ${asset.daysPastDue >= 90 ? "DAYS_PAST_DUE_90" : "RATING_DETERIORATION"}`;
      } else if (asset.daysPastDue >= 30 || asset.isForborne || asset.isOnWatchlist) {
        stage = "STAGE_2";
        stageReason = `Significant increase in credit risk: ${asset.daysPastDue >= 30 ? "DAYS_PAST_DUE_30" : asset.isForborne ? "FORBEARANCE" : "WATCHLIST"}`;
      }

      // Calculate PD based on rating
      const pdMap: Record<string, number> = {
        AAA: 0.0001, AA: 0.0002, A: 0.0005, BBB: 0.0015, BB: 0.005, B: 0.02, CCC: 0.08, CC: 0.2, C: 0.5, D: 1.0
      };
      const pd12Month = pdMap[asset.creditRating] || 0.01;
      const pdLifetime = Math.min(pd12Month * 5, 1.0);

      // Calculate LGD based on asset type and collateral
      let lgd = 0.45;
      if (asset.assetType === "HOME_LOAN" && asset.collateralValueCents) {
        lgd = 0.15;
      } else if (asset.assetType === "CREDIT_CARD") {
        lgd = 0.75;
      } else if (asset.assetType === "OVERDRAFT") {
        lgd = 0.60;
      }

      // Calculate ECL
      const ead = asset.outstandingBalanceCents / 100;
      const ecl12Month = ead * pd12Month * lgd;
      const eclLifetime = ead * pdLifetime * lgd;
      const eclProvision = stage === "STAGE_1" ? ecl12Month : eclLifetime;

      return {
        asset,
        ecl: {
          assetId: asset.assetId,
          stage,
          stageReason,
          pd12Month,
          pdLifetime,
          lgd,
          ead: `${ead.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          ecl12Month: `${ecl12Month.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          eclLifetime: `${eclLifetime.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          eclProvision: `${eclProvision.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}`,
          scenarioECLs: [
            { scenarioId: "BASE", weight: 0.5, ecl: `${(eclProvision * 1.0).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}` },
            { scenarioId: "UPSIDE", weight: 0.2, ecl: `${(eclProvision * 0.8).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}` },
            { scenarioId: "DOWNSIDE", weight: 0.3, ecl: `${(eclProvision * 1.5).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}` },
          ],
        },
        loading: false,
      };
    });

    setAssetsWithECL(results);
    setIsCalculating(false);
  };

  // Calculate portfolio summary
  const portfolioSummary = {
    totalAssets: assetsWithECL.length,
    totalExposure: assetsWithECL.reduce((sum, a) => sum + a.asset.outstandingBalanceCents, 0) / 100,
    stage1: assetsWithECL.filter(a => a.ecl?.stage === "STAGE_1"),
    stage2: assetsWithECL.filter(a => a.ecl?.stage === "STAGE_2"),
    stage3: assetsWithECL.filter(a => a.ecl?.stage === "STAGE_3"),
    totalECL: assetsWithECL.reduce((sum, a) => {
      if (!a.ecl) return sum;
      const amount = parseFloat(a.ecl.eclProvision.replace(/[^0-9.-]+/g, ""));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0),
  };

  const stage1Exposure = portfolioSummary.stage1.reduce((sum, a) => sum + a.asset.outstandingBalanceCents, 0) / 100;
  const stage2Exposure = portfolioSummary.stage2.reduce((sum, a) => sum + a.asset.outstandingBalanceCents, 0) / 100;
  const stage3Exposure = portfolioSummary.stage3.reduce((sum, a) => sum + a.asset.outstandingBalanceCents, 0) / 100;

  const stage1ECL = portfolioSummary.stage1.reduce((sum, a) => {
    if (!a.ecl) return sum;
    const amount = parseFloat(a.ecl.eclProvision.replace(/[^0-9.-]+/g, ""));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const stage2ECL = portfolioSummary.stage2.reduce((sum, a) => {
    if (!a.ecl) return sum;
    const amount = parseFloat(a.ecl.eclProvision.replace(/[^0-9.-]+/g, ""));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const stage3ECL = portfolioSummary.stage3.reduce((sum, a) => {
    if (!a.ecl) return sum;
    const amount = parseFloat(a.ecl.eclProvision.replace(/[^0-9.-]+/g, ""));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const coverageRatio = portfolioSummary.totalExposure > 0 
    ? (portfolioSummary.totalECL / portfolioSummary.totalExposure * 100).toFixed(2)
    : "0.00";

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "STAGE_1": return "text-emerald-400";
      case "STAGE_2": return "text-amber-400";
      case "STAGE_3": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "STAGE_1": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Stage 1</Badge>;
      case "STAGE_2": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Stage 2</Badge>;
      case "STAGE_3": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Stage 3</Badge>;
      default: return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            IFRS 9 ECL Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Expected Credit Loss Portfolio Analysis</p>
        </div>
        <Button 
          onClick={calculateAllECL}
          disabled={isCalculating}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isCalculating ? "animate-spin" : ""}`} />
          {isCalculating ? "Calculating..." : "Calculate ECL"}
        </Button>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {portfolioSummary.totalExposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
            </div>
            <p className="text-xs text-slate-500 mt-1">{portfolioSummary.totalAssets} assets</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Total ECL Provision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {portfolioSummary.totalECL.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Coverage: {coverageRatio}%</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Stage Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{portfolioSummary.stage1.length}</div>
                <div className="text-xs text-slate-500">S1</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{portfolioSummary.stage2.length}</div>
                <div className="text-xs text-slate-500">S2</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">{portfolioSummary.stage3.length}</div>
                <div className="text-xs text-slate-500">S3</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Impaired Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {portfolioSummary.totalAssets > 0 
                ? ((portfolioSummary.stage2.length + portfolioSummary.stage3.length) / portfolioSummary.totalAssets * 100).toFixed(1)
                : "0.0"}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Stage 2 + Stage 3</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Stage 1 */}
        <Card className="bg-slate-900/50 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Stage 1 - Performing
            </CardTitle>
            <p className="text-xs text-slate-500">12-month ECL</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Assets</span>
                <span className="text-white font-medium">{portfolioSummary.stage1.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exposure</span>
                <span className="text-white font-medium">{stage1Exposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ECL</span>
                <span className="text-emerald-400 font-medium">{stage1ECL.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coverage</span>
                <span className="text-white font-medium">{stage1Exposure > 0 ? (stage1ECL / stage1Exposure * 100).toFixed(2) : "0.00"}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage 2 */}
        <Card className="bg-slate-900/50 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Stage 2 - SICR
            </CardTitle>
            <p className="text-xs text-slate-500">Lifetime ECL</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Assets</span>
                <span className="text-white font-medium">{portfolioSummary.stage2.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exposure</span>
                <span className="text-white font-medium">{stage2Exposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ECL</span>
                <span className="text-amber-400 font-medium">{stage2ECL.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coverage</span>
                <span className="text-white font-medium">{stage2Exposure > 0 ? (stage2ECL / stage2Exposure * 100).toFixed(2) : "0.00"}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage 3 */}
        <Card className="bg-slate-900/50 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Stage 3 - Impaired
            </CardTitle>
            <p className="text-xs text-slate-500">Lifetime ECL (Credit-impaired)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Assets</span>
                <span className="text-white font-medium">{portfolioSummary.stage3.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exposure</span>
                <span className="text-white font-medium">{stage3Exposure.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ECL</span>
                <span className="text-red-400 font-medium">{stage3ECL.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coverage</span>
                <span className="text-white font-medium">{stage3Exposure > 0 ? (stage3ECL / stage3Exposure * 100).toFixed(2) : "0.00"}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset List */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Portfolio Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Asset</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Customer</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Exposure</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Rating</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">DPD</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Stage</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">ECL</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assetsWithECL.map((item) => (
                  <tr 
                    key={item.asset.assetId} 
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-white font-mono text-sm">{item.asset.assetId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-white">{item.asset.customerName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-400 text-sm">{item.asset.assetType.replace(/_/g, " ")}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-white">
                        {(item.asset.outstandingBalanceCents / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-slate-300 border-slate-600">
                        {item.asset.creditRating}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={item.asset.daysPastDue > 0 ? "text-amber-400" : "text-slate-400"}>
                        {item.asset.daysPastDue}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.ecl ? getStageBadge(item.ecl.stage) : <Badge variant="outline" className="text-slate-500">-</Badge>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={item.ecl ? getStageColor(item.ecl.stage) : "text-slate-500"}>
                        {item.ecl?.eclProvision || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAsset(item)}
                        disabled={!item.ecl}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Asset Detail Modal */}
      {selectedAsset && selectedAsset.ecl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-900 border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">{selectedAsset.asset.assetId}</CardTitle>
                <p className="text-slate-400">{selectedAsset.asset.customerName}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedAsset(null)}>×</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stage Info */}
              <div className="p-4 rounded-lg bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">IFRS 9 Stage</span>
                  {getStageBadge(selectedAsset.ecl.stage)}
                </div>
                <p className="text-sm text-slate-500">{selectedAsset.ecl.stageReason}</p>
              </div>

              {/* Risk Parameters */}
              <div>
                <h4 className="text-white font-medium mb-3">Risk Parameters</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded bg-slate-800/30">
                    <div className="text-slate-400 text-sm">12-Month PD</div>
                    <div className="text-white font-medium">{(selectedAsset.ecl.pd12Month * 100).toFixed(2)}%</div>
                  </div>
                  <div className="p-3 rounded bg-slate-800/30">
                    <div className="text-slate-400 text-sm">Lifetime PD</div>
                    <div className="text-white font-medium">{(selectedAsset.ecl.pdLifetime * 100).toFixed(2)}%</div>
                  </div>
                  <div className="p-3 rounded bg-slate-800/30">
                    <div className="text-slate-400 text-sm">LGD</div>
                    <div className="text-white font-medium">{(selectedAsset.ecl.lgd * 100).toFixed(0)}%</div>
                  </div>
                  <div className="p-3 rounded bg-slate-800/30">
                    <div className="text-slate-400 text-sm">EAD</div>
                    <div className="text-white font-medium">{selectedAsset.ecl.ead}</div>
                  </div>
                </div>
              </div>

              {/* ECL Amounts */}
              <div>
                <h4 className="text-white font-medium mb-3">ECL Calculation</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-emerald-400 text-sm">12-Month ECL</div>
                    <div className="text-white font-medium">{selectedAsset.ecl.ecl12Month}</div>
                  </div>
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="text-amber-400 text-sm">Lifetime ECL</div>
                    <div className="text-white font-medium">{selectedAsset.ecl.eclLifetime}</div>
                  </div>
                  <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                    <div className="text-blue-400 text-sm">Provision</div>
                    <div className="text-white font-medium">{selectedAsset.ecl.eclProvision}</div>
                  </div>
                </div>
              </div>

              {/* Scenario Breakdown */}
              <div>
                <h4 className="text-white font-medium mb-3">Scenario-Weighted ECL</h4>
                <div className="space-y-2">
                  {selectedAsset.ecl.scenarioECLs.map(scenario => (
                    <div key={scenario.scenarioId} className="flex items-center justify-between p-3 rounded bg-slate-800/30">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-slate-300">{scenario.scenarioId}</Badge>
                        <span className="text-slate-400 text-sm">Weight: {(scenario.weight * 100).toFixed(0)}%</span>
                      </div>
                      <span className="text-white font-medium">{scenario.ecl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
