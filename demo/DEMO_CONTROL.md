# Demo Traffic Control — Live Mode Switching

**One-command control** for live demo traffic presets during board/regulator presentations.

---

## 🎯 What This Does

The synthetic metrics generator supports **four demo traffic modes** that can be switched **live without restarting containers**:

| Mode | Description | Use Case |
|------|-------------|----------|
| **quiet** | Overnight / sleepy CU | Show baseline operations |
| **normal** | Business as usual | Standard demo state |
| **stressed** | Retail panic / fraud wave | Show system under pressure |
| **crisis** | Liquidity shock / cyber event | Show extreme stress handling |

**Key Properties:**
- ✅ Live switching (no container restarts)
- ✅ Deterministic, regulator-safe behaviour
- ✅ Prometheus-compatible metrics (unchanged)
- ✅ Safety invariants **always zero** (AI origin violations, schema violations)

---

## 🚀 Quick Start

### Check Current Mode

```bash
curl http://localhost:9200/mode
```

**Response:**
```json
{
  "mode": "normal",
  "description": "Business as usual",
  "config": {
    "rate": 15,
    "fraud": 0.10,
    "aml": 0.05,
    "treasury": 0.05
  }
}
```

### Switch Modes

```bash
# Quiet (overnight / sleepy CU)
curl -X POST http://localhost:9200/mode/quiet

# Normal (business as usual)
curl -X POST http://localhost:9200/mode/normal

# Stressed (retail panic / fraud wave)
curl -X POST http://localhost:9200/mode/stressed

# Crisis (liquidity shock / cyber event)
curl -X POST http://localhost:9200/mode/crisis
```

**Grafana responds within 1–2 refresh cycles (5–10 seconds).**

---

## 📊 Mode Specifications

### Quiet Mode

**Event Rate:** 5 payments/5s  
**Fraud Risk:** 2% high-risk  
**AML Risk:** 1% high-risk  
**Treasury Risk:** 1% high-risk

**Use Case:** Show baseline operations, overnight activity

### Normal Mode

**Event Rate:** 15 payments/5s  
**Fraud Risk:** 10% high-risk  
**AML Risk:** 5% high-risk  
**Treasury Risk:** 5% high-risk

**Use Case:** Standard demo state, business as usual

### Stressed Mode

**Event Rate:** 40 payments/5s  
**Fraud Risk:** 30% high-risk  
**AML Risk:** 20% high-risk  
**Treasury Risk:** 25% high-risk

**Use Case:** Show system under pressure, retail panic, fraud wave

### Crisis Mode

**Event Rate:** 90 payments/5s  
**Fraud Risk:** 70% high-risk  
**AML Risk:** 50% high-risk  
**Treasury Risk:** 60% high-risk

**Use Case:** Show extreme stress handling, liquidity shock, cyber event

---

## 🎬 Demo Choreography

Here's the recommended meeting choreography for board/regulator presentations:

### 1. Start in NORMAL Mode

**Show:**
- Stable payments RL volume
- Modest fraud + AML flags
- Treasury calm
- Enforcement violations = 0

**Narrative:**
> "This is business as usual for a mid-sized credit union. The Risk Brain is running in shadow mode, generating advisories but not executing."

### 2. Switch to STRESSED Mode (Live)

```bash
curl -X POST http://localhost:9200/mode/stressed
```

**Show:**
- Fraud HIGH flags spike
- AML HIGH flags rise
- Treasury advisories increase
- Enforcement violations **still zero**

**Narrative:**
> "Here we're seeing early systemic instability — retail panic or a fraud wave. The Risk Brain is detecting the anomalies and raising advisories, but it's still shadow-only. No execution."

### 3. Switch to CRISIS Mode (Live)

```bash
curl -X POST http://localhost:9200/mode/crisis
```

**Show:**
- Explosive fraud + AML flags
- Treasury high-risk dominates
- Payments RL volume surges
- Safety invariants **still pinned to zero**

**Narrative:**
> "This is exactly the moment you never want an autonomous AI touching money. The Risk Brain is screaming, but it's still advisory-only. No execution authority."

### 4. Return to NORMAL Mode

```bash
curl -X POST http://localhost:9200/mode/normal
```

**Show:**
- Everything gracefully decays
- Metrics return to baseline
- Enforcement violations **still zero**

**Narrative:**
> "The system gracefully returns to normal. The Risk Brain adapts to the new baseline without any manual intervention."

---

## 🔧 Technical Details

### Control API Endpoints

**Base URL:** `http://localhost:9200`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mode` | Get current mode and configuration |
| POST | `/mode/<name>` | Set mode (quiet, normal, stressed, crisis) |
| GET | `/health` | Health check endpoint |

### Metrics Exported

**Prometheus metrics on port 9100:**

| Metric | Type | Description |
|--------|------|-------------|
| `payments_rl_policy_evaluated_total` | Counter | Payments evaluated by RL |
| `fraud_risk_flag_raised_total{risk_band}` | Counter | Fraud flags (HIGH, MEDIUM) |
| `aml_risk_flag_raised_total{risk_band}` | Counter | AML flags (HIGH, MEDIUM) |
| `treasury_risk_advisories_total{risk_band}` | Counter | Treasury advisories (HIGH, MEDIUM) |
| `risk_brain_ai_origin_block_violations_total` | Gauge | AI execution violations (ALWAYS 0) |
| `risk_brain_schema_version_violations_total` | Gauge | Schema violations (ALWAYS 0) |

### Safety Invariants

**These metrics are HARD-ZEROED at all times:**
- `risk_brain_ai_origin_block_violations_total` = **0**
- `risk_brain_schema_version_violations_total` = **0**

**This proves AI non-execution is mechanically enforced, not just policy-enforced.**

---

## 🎯 Strategic Value

**Controlled Narrative Engine:**
- ✅ Show baseline operations (quiet)
- ✅ Show business as usual (normal)
- ✅ Show system under pressure (stressed)
- ✅ Show extreme stress handling (crisis)
- ✅ Prove AI non-execution at all times

**Regulator-Safe:**
- ✅ Deterministic behaviour (no randomness)
- ✅ Safety invariants always zero
- ✅ Live switching without restarts
- ✅ Prometheus-compatible metrics

**Board-Grade:**
- ✅ Professional demo choreography
- ✅ Clear narrative progression
- ✅ Proof of AI non-execution
- ✅ Category-leading demo infrastructure

---

## 🚀 Next Steps

### Immediate (Today)

1. **Test Mode Switching**
   ```bash
   # Start demo stack
   docker compose -f docker-compose.demo.yml up
   
   # Test mode switching
   curl -X POST http://localhost:9200/mode/stressed
   curl http://localhost:9200/mode
   curl -X POST http://localhost:9200/mode/normal
   ```

2. **Verify Grafana Updates**
   - Open http://localhost:3001
   - Navigate to Risk Brain demo dashboard
   - Verify metrics update within 5–10 seconds

### Short-Term (This Week)

3. **Practice Demo Choreography**
   - Run through full demo script
   - Practice mode switching timing
   - Refine narrative for board/regulator presentations

4. **Prepare Board Demo**
   - Use NORMAL → STRESSED → CRISIS progression
   - Emphasize safety invariants (always zero)
   - Show Grafana dashboard updates

### Medium-Term (Next Month)

5. **Optional: Add UI Control Panel**
   - Add demo control buttons to UI (developer role only)
   - Wire to `/mode/<name>` API
   - Hide from production builds

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first board presentation
