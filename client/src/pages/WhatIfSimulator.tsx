import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FlaskConical,
  Play,
  RotateCcw,
  Save,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Zap,
  Settings2,
  FileText,
  History,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface PolicyParameter {
  id: string;
  name: string;
  description: string;
  type: "number" | "boolean" | "threshold";
  currentValue: number | boolean;
  simulatedValue: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

interface SimulationResult {
  outcome: "APPROVED" | "REJECTED" | "REVIEW";
  confidence: number;
  risk_score: number;
  rules_triggered: string[];
  impact: {
    approval_rate_change: number;
    risk_exposure_change: number;
    false_positive_change: number;
  };
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, number | boolean>;
  created_at: Date;
}

// Mock policy parameters
const defaultParameters: PolicyParameter[] = [
  {
    id: "credit_score_threshold",
    name: "Credit Score Threshold",
    description: "Minimum credit score required for automatic approval",
    type: "threshold",
    currentValue: 650,
    simulatedValue: 650,
    min: 500,
    max: 800,
    step: 10,
    unit: "points",
  },
  {
    id: "debt_to_income_max",
    name: "Max Debt-to-Income Ratio",
    description: "Maximum allowed DTI ratio for loan approval",
    type: "threshold",
    currentValue: 0.43,
    simulatedValue: 0.43,
    min: 0.2,
    max: 0.6,
    step: 0.01,
    unit: "%",
  },
  {
    id: "max_loan_amount",
    name: "Maximum Loan Amount",
    description: "Upper limit for loan applications",
    type: "number",
    currentValue: 100000,
    simulatedValue: 100000,
    min: 10000,
    max: 500000,
    step: 5000,
    unit: "$",
  },
  {
    id: "employment_years_min",
    name: "Min Employment Years",
    description: "Minimum years of employment required",
    type: "number",
    currentValue: 2,
    simulatedValue: 2,
    min: 0,
    max: 10,
    step: 0.5,
    unit: "years",
  },
  {
    id: "fraud_check_enabled",
    name: "Fraud Detection",
    description: "Enable real-time fraud detection checks",
    type: "boolean",
    currentValue: true,
    simulatedValue: true,
  },
  {
    id: "manual_review_threshold",
    name: "Manual Review Threshold",
    description: "Risk score above which applications require manual review",
    type: "threshold",
    currentValue: 0.6,
    simulatedValue: 0.6,
    min: 0.3,
    max: 0.9,
    step: 0.05,
    unit: "",
  },
  {
    id: "high_risk_region_check",
    name: "High-Risk Region Check",
    description: "Enable additional checks for high-risk geographic regions",
    type: "boolean",
    currentValue: true,
    simulatedValue: true,
  },
  {
    id: "income_verification_required",
    name: "Income Verification",
    description: "Require income verification for all applications",
    type: "boolean",
    currentValue: true,
    simulatedValue: true,
  },
];

// Mock saved scenarios
const savedScenarios: Scenario[] = [
  {
    id: "1",
    name: "Conservative Policy",
    description: "Stricter thresholds for risk-averse lending",
    parameters: { credit_score_threshold: 700, debt_to_income_max: 0.35 },
    created_at: new Date("2024-12-15"),
  },
  {
    id: "2",
    name: "Growth Mode",
    description: "Relaxed thresholds to increase approval rates",
    parameters: { credit_score_threshold: 600, debt_to_income_max: 0.50 },
    created_at: new Date("2024-12-16"),
  },
];

function OutcomeBadge({ outcome, size = "default" }: { outcome: string; size?: "default" | "large" }) {
  const config = {
    APPROVED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    REJECTED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
    REVIEW: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  }[outcome] || { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: AlertTriangle };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} gap-1 ${size === "large" ? "text-lg px-4 py-2" : ""}`}>
      <Icon className={size === "large" ? "h-5 w-5" : "h-3 w-3"} />
      {outcome}
    </Badge>
  );
}

function ImpactIndicator({ value, label, inverse = false }: { value: number; label: string; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className={`flex items-center gap-1 font-mono ${
        isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted-foreground"
      }`}>
        {value > 0 ? <TrendingUp className="h-4 w-4" /> : value < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
      </div>
    </div>
  );
}

export default function WhatIfSimulator() {
  const [parameters, setParameters] = useState<PolicyParameter[]>(defaultParameters);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState("parameters");
  const [scenarioName, setScenarioName] = useState("");

  const handleParameterChange = (id: string, value: number | boolean) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, simulatedValue: value } : p))
    );
    setSimulationResult(null);
  };

  const handleReset = () => {
    setParameters((prev) =>
      prev.map((p) => ({ ...p, simulatedValue: p.currentValue }))
    );
    setSimulationResult(null);
    toast.info("Parameters reset to current values");
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock simulation result based on parameter changes
    const creditThreshold = parameters.find((p) => p.id === "credit_score_threshold")?.simulatedValue as number;
    const dtiMax = parameters.find((p) => p.id === "debt_to_income_max")?.simulatedValue as number;
    const reviewThreshold = parameters.find((p) => p.id === "manual_review_threshold")?.simulatedValue as number;

    const approvalRateChange = (650 - creditThreshold) * 0.002 + (dtiMax - 0.43) * 0.5;
    const riskExposureChange = approvalRateChange * 0.8;
    const falsePositiveChange = (reviewThreshold - 0.6) * -0.3;

    const result: SimulationResult = {
      outcome: approvalRateChange > 0.05 ? "APPROVED" : approvalRateChange < -0.05 ? "REJECTED" : "REVIEW",
      confidence: 0.85 + Math.random() * 0.1,
      risk_score: 0.3 + Math.random() * 0.3,
      rules_triggered: [
        "credit_score_check",
        "income_verification",
        ...(dtiMax > 0.45 ? ["high_dti_warning"] : []),
        ...(creditThreshold < 620 ? ["subprime_lending_flag"] : []),
      ],
      impact: {
        approval_rate_change: approvalRateChange,
        risk_exposure_change: riskExposureChange,
        false_positive_change: falsePositiveChange,
      },
    };

    setSimulationResult(result);
    setIsSimulating(false);
    toast.success("Simulation completed");
  };

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }
    toast.success(`Scenario "${scenarioName}" saved`);
    setScenarioName("");
  };

  const handleLoadScenario = (scenario: Scenario) => {
    setParameters((prev) =>
      prev.map((p) => ({
        ...p,
        simulatedValue: scenario.parameters[p.id] ?? p.currentValue,
      }))
    );
    setSimulationResult(null);
    toast.info(`Loaded scenario: ${scenario.name}`);
  };

  const hasChanges = parameters.some((p) => p.simulatedValue !== p.currentValue);

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20">
            <FlaskConical className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              What-If Simulator
            </h1>
            <p className="text-muted-foreground">Test policy changes before deployment</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleRunSimulation} disabled={isSimulating || !hasChanges}>
              <Play className="h-4 w-4 mr-2" />
              {isSimulating ? "Simulating..." : "Run Simulation"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Parameter Controls */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="parameters">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Parameters
                </TabsTrigger>
                <TabsTrigger value="scenarios">
                  <History className="h-4 w-4 mr-2" />
                  Saved Scenarios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parameters" className="space-y-4">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-cyan-400" />
                      Policy Parameters
                    </CardTitle>
                    <CardDescription>Adjust parameters to simulate policy changes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {parameters.map((param) => (
                      <div key={param.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">{param.name}</Label>
                            <p className="text-xs text-muted-foreground">{param.description}</p>
                          </div>
                          {param.simulatedValue !== param.currentValue && (
                            <Badge variant="outline" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                              Modified
                            </Badge>
                          )}
                        </div>

                        {param.type === "boolean" ? (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                            <span className="text-sm">
                              Current: <span className="font-mono">{param.currentValue ? "Enabled" : "Disabled"}</span>
                            </span>
                            <Switch
                              checked={param.simulatedValue as boolean}
                              onCheckedChange={(checked) => handleParameterChange(param.id, checked)}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Current: {param.unit === "$" ? "$" : ""}{param.currentValue}{param.unit === "%" ? "%" : param.unit === "points" ? "" : param.unit ? ` ${param.unit}` : ""}</span>
                              <span className="font-mono text-foreground">
                                {param.unit === "$" ? "$" : ""}{param.simulatedValue}{param.unit === "%" ? "%" : param.unit === "points" ? "" : param.unit ? ` ${param.unit}` : ""}
                              </span>
                            </div>
                            <Slider
                              value={[param.simulatedValue as number]}
                              onValueChange={([value]) => handleParameterChange(param.id, value)}
                              min={param.min}
                              max={param.max}
                              step={param.step}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{param.unit === "$" ? "$" : ""}{param.min}</span>
                              <span>{param.unit === "$" ? "$" : ""}{param.max}</span>
                            </div>
                          </div>
                        )}
                        <Separator />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="scenarios" className="space-y-4">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-cyan-400" />
                      Saved Scenarios
                    </CardTitle>
                    <CardDescription>Load previously saved parameter configurations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {savedScenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="p-4 rounded-lg border border-border bg-secondary/20 hover:border-cyan-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{scenario.name}</h4>
                            <p className="text-sm text-muted-foreground">{scenario.description}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleLoadScenario(scenario)}>
                            Load
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(scenario.parameters).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key.replace(/_/g, " ")}: {typeof value === "number" ? value.toLocaleString() : String(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Save New Scenario */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Save className="h-5 w-5 text-cyan-400" />
                      Save Current Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Scenario name..."
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        className="bg-secondary/30"
                      />
                      <Button onClick={handleSaveScenario} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Simulation Results */}
          <div className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-cyan-400" />
                  Simulation Results
                </CardTitle>
                <CardDescription>Predicted impact of policy changes</CardDescription>
              </CardHeader>
              <CardContent>
                {simulationResult ? (
                  <div className="space-y-4">
                    {/* Predicted Outcome */}
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-2">Sample Decision Outcome</p>
                      <OutcomeBadge outcome={simulationResult.outcome} size="large" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Confidence: {(simulationResult.confidence * 100).toFixed(1)}%
                      </p>
                    </div>

                    <Separator />

                    {/* Impact Metrics */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Projected Impact
                      </h4>
                      <ImpactIndicator
                        value={simulationResult.impact.approval_rate_change}
                        label="Approval Rate"
                      />
                      <ImpactIndicator
                        value={simulationResult.impact.risk_exposure_change}
                        label="Risk Exposure"
                        inverse
                      />
                      <ImpactIndicator
                        value={simulationResult.impact.false_positive_change}
                        label="False Positives"
                        inverse
                      />
                    </div>

                    <Separator />

                    {/* Rules Triggered */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Rules Triggered
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {simulationResult.rules_triggered.map((rule) => (
                          <Badge key={rule} variant="secondary" className="text-xs font-mono">
                            {rule}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 space-y-2">
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Export Report
                      </Button>
                      <Button variant="outline" className="w-full">
                        <FileText className="h-4 w-4 mr-2" />
                        View Full Analysis
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FlaskConical className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {hasChanges
                        ? "Click 'Run Simulation' to see predicted impact"
                        : "Adjust parameters to begin simulation"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="glass-panel border-cyan-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-cyan-400" />
                  Simulation Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Lower credit thresholds increase approval rates but may increase risk exposure</p>
                <p>• Adjusting the manual review threshold affects operational workload</p>
                <p>• Save scenarios to compare different policy configurations</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
