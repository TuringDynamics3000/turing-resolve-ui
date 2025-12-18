import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileCode,
  Save,
  Play,
  History,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  GitCompare,
  Upload,
  Download,
  Shield,
  Clock,
  User,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

// Sample policy DSL
const samplePolicies = {
  'credit-limit': `# Credit Limit Policy v2.1
# Last updated: 2024-12-16

POLICY credit_limit_check {
  DESCRIPTION "Determines customer credit limit based on risk profile"
  VERSION "2.1.0"
  EFFECTIVE_DATE "2024-01-01"
  
  INPUTS {
    customer_id: STRING
    income: DECIMAL
    credit_score: INTEGER
    existing_debt: DECIMAL
    employment_status: ENUM(EMPLOYED, SELF_EMPLOYED, UNEMPLOYED)
  }
  
  RULES {
    # Base limit calculation
    base_limit = income * 0.3
    
    # Credit score adjustments
    IF credit_score >= 750 THEN
      score_multiplier = 1.5
    ELSE IF credit_score >= 650 THEN
      score_multiplier = 1.0
    ELSE IF credit_score >= 550 THEN
      score_multiplier = 0.7
    ELSE
      score_multiplier = 0.3
    END
    
    # Employment adjustment
    IF employment_status == EMPLOYED THEN
      employment_factor = 1.0
    ELSE IF employment_status == SELF_EMPLOYED THEN
      employment_factor = 0.85
    ELSE
      employment_factor = 0.5
    END
    
    # Debt-to-income ratio check
    dti_ratio = existing_debt / income
    IF dti_ratio > 0.4 THEN
      DECLINE reason="DTI_RATIO_EXCEEDED"
    END
    
    # Calculate final limit
    final_limit = base_limit * score_multiplier * employment_factor
    
    # Cap at maximum
    IF final_limit > 50000 THEN
      final_limit = 50000
    END
  }
  
  OUTPUT {
    decision: ENUM(APPROVE, DECLINE, REVIEW)
    credit_limit: DECIMAL
    reason_code: STRING
  }
}`,
  'payment-fraud': `# Payment Fraud Detection Policy v1.3
# Real-time fraud screening for outbound payments

POLICY payment_fraud_check {
  DESCRIPTION "Screens payments for potential fraud indicators"
  VERSION "1.3.0"
  EFFECTIVE_DATE "2024-06-01"
  
  INPUTS {
    payment_id: STRING
    amount: DECIMAL
    currency: STRING
    sender_account: STRING
    recipient_account: STRING
    recipient_country: STRING
    device_fingerprint: STRING
    ip_address: STRING
  }
  
  RULES {
    # High-risk country check
    high_risk_countries = ["XX", "YY", "ZZ"]
    IF recipient_country IN high_risk_countries THEN
      risk_score = risk_score + 30
    END
    
    # Large amount threshold
    IF amount > 10000 THEN
      risk_score = risk_score + 20
    END
    
    # Velocity check (external call)
    recent_count = CALL velocity_service(sender_account, "24h")
    IF recent_count > 5 THEN
      risk_score = risk_score + 25
    END
    
    # Device reputation
    device_risk = CALL device_reputation(device_fingerprint)
    IF device_risk == "HIGH" THEN
      risk_score = risk_score + 40
    END
    
    # Decision logic
    IF risk_score >= 70 THEN
      DECLINE reason="HIGH_FRAUD_RISK"
    ELSE IF risk_score >= 40 THEN
      REVIEW reason="ELEVATED_RISK"
    ELSE
      APPROVE
    END
  }
  
  OUTPUT {
    decision: ENUM(APPROVE, DECLINE, REVIEW)
    risk_score: INTEGER
    risk_factors: ARRAY[STRING]
  }
}`,
  'loan-approval': `# Loan Approval Policy v3.0
# Automated loan decisioning with ML model integration

POLICY loan_approval {
  DESCRIPTION "Evaluates loan applications using rules and ML models"
  VERSION "3.0.0"
  EFFECTIVE_DATE "2024-09-01"
  
  INPUTS {
    application_id: STRING
    customer_id: STRING
    loan_amount: DECIMAL
    loan_term_months: INTEGER
    purpose: ENUM(HOME, AUTO, PERSONAL, BUSINESS)
    income: DECIMAL
    employment_years: INTEGER
  }
  
  MODELS {
    credit_risk_model = "credit-risk-v2.1"
    affordability_model = "affordability-v1.5"
  }
  
  RULES {
    # Get ML model predictions
    credit_risk = PREDICT credit_risk_model {
      customer_id: customer_id
      loan_amount: loan_amount
    }
    
    affordability = PREDICT affordability_model {
      income: income
      loan_amount: loan_amount
      term: loan_term_months
    }
    
    # Hard decline rules
    IF credit_risk.pd > 0.15 THEN
      DECLINE reason="HIGH_DEFAULT_RISK"
    END
    
    IF affordability.dti > 0.45 THEN
      DECLINE reason="AFFORDABILITY_FAILED"
    END
    
    # Approval with conditions
    IF credit_risk.pd <= 0.05 AND affordability.dti <= 0.30 THEN
      APPROVE rate_tier="PRIME"
    ELSE IF credit_risk.pd <= 0.10 THEN
      APPROVE rate_tier="STANDARD"
    ELSE
      REVIEW reason="BORDERLINE_RISK"
    END
  }
  
  OUTPUT {
    decision: ENUM(APPROVE, DECLINE, REVIEW)
    rate_tier: STRING
    monthly_payment: DECIMAL
    reason_codes: ARRAY[STRING]
  }
}`
};

// Policy version history
const versionHistory = [
  { version: '2.1.0', date: '2024-12-16', author: 'admin@turing.com', status: 'active', changes: 'Added DTI ratio check' },
  { version: '2.0.0', date: '2024-11-01', author: 'policy@turing.com', status: 'archived', changes: 'Major refactor of scoring logic' },
  { version: '1.5.0', date: '2024-09-15', author: 'admin@turing.com', status: 'archived', changes: 'Added employment factor' },
  { version: '1.0.0', date: '2024-06-01', author: 'policy@turing.com', status: 'archived', changes: 'Initial release' },
];

// Validation result type
interface ValidationResult {
  valid: boolean;
  errors: { line: number; message: string; severity: 'error' | 'warning' }[];
}

function validatePolicy(code: string): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const lines = code.split('\n');
  
  // Simple validation rules
  let hasPolicy = false;
  let hasInputs = false;
  let hasRules = false;
  let hasOutput = false;
  let braceCount = 0;
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    
    if (trimmed.startsWith('POLICY ')) hasPolicy = true;
    if (trimmed === 'INPUTS {') hasInputs = true;
    if (trimmed === 'RULES {') hasRules = true;
    if (trimmed === 'OUTPUT {') hasOutput = true;
    
    // Count braces
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    // Check for common issues
    if (trimmed.includes('IF ') && !trimmed.includes('THEN') && !trimmed.includes('ELSE')) {
      errors.push({ line: lineNum, message: 'IF statement missing THEN clause', severity: 'error' });
    }
    
    if (trimmed.includes('DECLINE') && !trimmed.includes('reason=')) {
      errors.push({ line: lineNum, message: 'DECLINE should include a reason', severity: 'warning' });
    }
  });
  
  if (!hasPolicy) {
    errors.push({ line: 1, message: 'Missing POLICY declaration', severity: 'error' });
  }
  if (!hasInputs) {
    errors.push({ line: 1, message: 'Missing INPUTS block', severity: 'warning' });
  }
  if (!hasRules) {
    errors.push({ line: 1, message: 'Missing RULES block', severity: 'error' });
  }
  if (!hasOutput) {
    errors.push({ line: 1, message: 'Missing OUTPUT block', severity: 'warning' });
  }
  if (braceCount !== 0) {
    errors.push({ line: lines.length, message: 'Unbalanced braces', severity: 'error' });
  }
  
  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  };
}

export default function PolicyEditor() {
  const [selectedPolicy, setSelectedPolicy] = useState<string>('credit-limit');
  const [code, setCode] = useState(samplePolicies['credit-limit']);
  const [originalCode, setOriginalCode] = useState(samplePolicies['credit-limit']);
  const [validation, setValidation] = useState<ValidationResult>({ valid: true, errors: [] });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    const result = validatePolicy(code);
    setValidation(result);
    setIsDirty(code !== originalCode);
  }, [code, originalCode]);

  const handlePolicyChange = (policyKey: string) => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setSelectedPolicy(policyKey);
    const newCode = samplePolicies[policyKey as keyof typeof samplePolicies];
    setCode(newCode);
    setOriginalCode(newCode);
    setIsDirty(false);
  };

  const handleSave = async () => {
    if (!validation.valid) {
      toast.error('Cannot save', { description: 'Please fix validation errors first' });
      return;
    }
    
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setOriginalCode(code);
    setIsDirty(false);
    setIsSaving(false);
    toast.success('Policy saved as draft', { description: 'Submit for approval to activate' });
  };

  const handlePublish = async () => {
    if (!validation.valid) {
      toast.error('Cannot publish', { description: 'Please fix validation errors first' });
      return;
    }
    
    toast.success('Policy submitted for approval', { 
      description: 'A compliance approver must review before activation' 
    });
  };

  const handleExport = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPolicy}-policy.dsl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileCode className="w-6 h-6 text-primary" />
                Policy Editor
              </h1>
              <p className="text-muted-foreground">
                Edit and manage decision policies with syntax validation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button 
              size="sm" 
              onClick={handlePublish}
              disabled={!validation.valid || isDirty}
            >
              <Upload className="w-4 h-4 mr-2" />
              Submit for Approval
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar - Policy list */}
          <div className="col-span-3 space-y-4">
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(samplePolicies).map((key) => (
                  <button
                    key={key}
                    onClick={() => handlePolicyChange(key)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedPolicy === key
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{key}</span>
                      <Badge variant="outline" className="text-xs">
                        v2.1
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {key === 'credit-limit' && 'Credit limit calculation'}
                      {key === 'payment-fraud' && 'Fraud detection rules'}
                      {key === 'loan-approval' && 'Loan decisioning'}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Validation Status */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {validation.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {validation.errors.length === 0 ? (
                  <p className="text-sm text-green-500">No issues found</p>
                ) : (
                  <div className="space-y-2">
                    {validation.errors.map((error, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-xs ${
                          error.severity === 'error'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <span className="font-mono">Line {error.line}:</span>{' '}
                        {error.message}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main editor */}
          <div className="col-span-9 space-y-4">
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm">{selectedPolicy}.dsl</CardTitle>
                    {isDirty && (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                        Unsaved changes
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDiff(!showDiff)}
                      disabled={!isDirty}
                    >
                      <GitCompare className="w-4 h-4 mr-1" />
                      {showDiff ? 'Hide' : 'Show'} Diff
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono text-sm min-h-[500px] bg-muted/30 resize-none"
                    spellCheck={false}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {code.split('\n').length} lines
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {versionHistory.map((version, i) => (
                    <div
                      key={version.version}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={version.status === 'active' ? 'default' : 'secondary'}
                        >
                          v{version.version}
                        </Badge>
                        <div>
                          <p className="text-sm">{version.changes}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            {version.author}
                            <Clock className="w-3 h-3 ml-2" />
                            {version.date}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {version.status !== 'active' && (
                          <Button variant="ghost" size="sm">
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
