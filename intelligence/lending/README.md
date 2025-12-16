# Lending AI Advisors

**CRITICAL: AI advisors produce recommendations only. They NEVER execute.**

## Hard Rules

1. **AI advisors score/predict/suggest**
2. **AI advisors NEVER emit LoanFacts**
3. **AI advisors NEVER trigger repayments**
4. **AI advisors NEVER change loan state**
5. **AI advisors NEVER bypass human or policy gates**

## Advisory Modules

### CreditRiskAdvisor.ts
- **Purpose:** ML-powered default risk assessment
- **Input:** Loan facts, deposit facts, external credit score
- **Output:** Default probability, risk score, risk factors
- **Model:** Simplified logistic regression (production: XGBoost/neural network)

### DelinquencyAdvisor.ts
- **Purpose:** ML-powered arrears prediction
- **Input:** Loan facts, deposit facts, current date
- **Output:** Arrears probability, predicted days past due, early warning signals
- **Model:** Pattern recognition (production: time-series forecasting)

### RestructureAdvisor.ts (TODO)
- **Purpose:** ML-powered restructure term suggestions
- **Input:** Loan facts, borrower financial situation
- **Output:** Suggested terms, estimated recovery rate

## Architecture

```
┌─────────────────┐
│   Loan Facts    │
│  Deposit Facts  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Advisors    │  ← ML models
│  (Recommend)    │  ← No side effects
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AdvisoryFact    │  ← Stored as fact
│ (Audit Trail)   │  ← Never executed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Operator UI    │  ← Human reviews
│  (Decide)       │  ← Human approves
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Application    │  ← Emits facts
│  Handlers       │  ← Executes decision
└─────────────────┘
```

## Why This Is State-of-the-Art

**vs HES (AI-Powered Underwriting):**
- HES: AI executes decisions directly
- TuringCore: AI advises, humans execute

**vs Traditional Core Banking:**
- Traditional: No AI, manual processes
- TuringCore: AI-assisted, human-governed

**Regulator-Safe:**
- AI recommendations are auditable (stored as AdvisoryFacts)
- AI never bypasses human oversight
- AI model versions are tracked
- AI rationale is always provided

## Usage Example

```typescript
import { assessCreditRisk } from "./CreditRiskAdvisor";

// AI produces advisory
const advisory = assessCreditRisk({
  loanId: "LOAN-001",
  loanFacts: [...],
  depositFacts: [...],
  externalCreditScore: 720,
});

console.log(advisory);
// {
//   recommendation: "NO_ACTION",
//   confidence: 0.9,
//   rationale: "Low default probability (15.3%). No action required.",
//   modelVersion: "credit-risk-v1.0.0",
//   defaultProbability: 0.153,
//   riskScore: 15,
//   riskFactors: ["No significant risk factors identified"]
// }

// Store as AdvisoryFact (not executed)
await addShadowAIAdvisory({
  entityId: "LOAN-001",
  entityType: "LOAN",
  domain: "CREDIT_RISK",
  advisory: advisory.rationale,
  confidence: advisory.confidence,
  metadata: advisory,
});

// Operator reviews → decides → emits fact
```

## Model Deployment

All AI models MUST:

1. **Be versioned** (e.g., `credit-risk-v1.0.0`)
2. **Provide confidence scores** (0-1)
3. **Provide rationale** (human-readable explanation)
4. **Be deterministic** (same input → same output for same version)
5. **Be shadow-testable** (run alongside existing logic before cutover)

## Shadow Testing

Before deploying a new AI model:

1. Deploy in shadow mode (advisory only, not executed)
2. Run for 30 days alongside existing logic
3. Compare AI recommendations vs human decisions
4. Measure accuracy, false positives, false negatives
5. If metrics pass threshold, promote to production
6. If metrics fail, retrain model

## Compliance

All AI advisories are stored as AdvisoryFacts, providing:

- **Explainability:** Rationale for every recommendation
- **Auditability:** Full history of AI recommendations
- **Reversibility:** Decisions can be reviewed and reversed
- **Transparency:** Model version and confidence tracked

This meets APRA, ASIC, and international AI governance standards.
