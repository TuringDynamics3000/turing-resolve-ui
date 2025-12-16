# Risk Brain Governance UI — Docker Demo Stack

**One-command local demo environment** with full Prometheus + Grafana integration.

---

## 🚀 Quick Start

From the repository root:

```bash
docker compose -f docker-compose.demo.yml up
```

**Then open:**

| Purpose | URL | Credentials |
|---------|-----|-------------|
| **Governance UI** | http://localhost:3000 | N/A (demo mode) |
| **UI Gateway API** | http://localhost:8080 | N/A |
| **Prometheus** | http://localhost:9090 | N/A |
| **Grafana** | http://localhost:3001 | admin / admin |

---

## 📦 What's Included

### 1. Governance UI (Next.js)

**Features:**
- ✅ System health dashboard
- ✅ Domain metrics (Payments, Fraud, AML, Treasury)
- ✅ Digital Twin scenario status
- ✅ **Embedded PDF viewer** (board packs, regulator annexes)
- ✅ **Live role switcher** (operator, board, regulator, developer)

### 2. UI Gateway (Mock API)

**Endpoints:**
- `GET /api/v1/ui/system/health` — System health metrics
- `GET /api/v1/ui/domains` — Domain status and metrics
- `GET /api/v1/ui/twin/scenarios` — Digital Twin scenarios
- `GET /api/v1/ui/documents/board-packs` — Board pack list
- `GET /api/v1/ui/documents/regulator-annexes` — Regulator annex list

### 3. Prometheus (Metrics)

**Scrape targets:**
- UI Gateway (mock metrics)
- Placeholder for future Risk Brain services

### 4. Grafana (Dashboards)

**Pre-loaded dashboards:**
- **Risk Brain — Demo Ops** (system health, domain advisory volume)

**Datasources:**
- Prometheus (auto-provisioned)

---

## 🎯 Demo Scenarios

### For Board Presentations:

1. Open http://localhost:3000
2. Click **"board"** in role switcher
3. Navigate to **Board Packs**
4. Click **"View PDF"** on Week-0 board pack
5. PDF opens **in-app** (no new tabs)
6. Walk through executive summary, safety attestation, domain summaries

### For Regulator Pre-Engagement:

1. Open http://localhost:3000
2. Click **"regulator"** in role switcher
3. Navigate to **Regulator Annexes**
4. Click **"View PDF"** on Week-0 regulator annex
5. PDF opens **in-app** (no new tabs)
6. Walk through regulatory assertion, replay pointers, safety invariants

### For Operational Demonstrations:

1. Open http://localhost:3000
2. Click **"operator"** in role switcher
3. Navigate to **System** page
4. Show domain status (all enabled)
5. Show enforcement metrics (all 0)
6. Navigate to **Domains** page
7. Show domain-level metrics (events, advisories, coverage, confidence)
8. Navigate to **Twin** page
9. Show scenario status (steady_state_with_fraud_spike completed)

### For Technical Demonstrations:

1. Open http://localhost:3000
2. Click **"developer"** in role switcher
3. Navigate to **System** page
4. Show kill-switch status (all disabled)
5. Open http://localhost:3001 (Grafana)
6. Navigate to **Risk Brain — Demo Ops** dashboard
7. Show AI origin violations (must be 0)
8. Show schema violations (must be 0)
9. Show domain advisory volume (time series)

---

## 🎛️ Demo Traffic Control

**Live mode switching** for controlled demo narratives:

```bash
# Check current mode
curl http://localhost:9200/mode

# Switch modes (quiet, normal, stressed, crisis)
curl -X POST http://localhost:9200/mode/stressed
curl -X POST http://localhost:9200/mode/crisis
curl -X POST http://localhost:9200/mode/normal
```

**See [demo/DEMO_CONTROL.md](demo/DEMO_CONTROL.md) for full documentation.**

---

## 🔧 Advanced Usage

### Customize Demo Data

Edit mock JSON files in `apps/risk-brain-ui-gateway/mock/`:
- `system-health.json` — System health metrics
- `domains.json` — Domain status and metrics
- `twin-scenarios.json` — Digital Twin scenarios
- `board-packs.json` — Board pack list
- `regulator-annexes.json` — Regulator annex list

### Add Custom PDFs

Place PDF files in `apps/risk-brain-ui-gateway/demo-pdfs/` and update mock JSON files to reference them.

### Customize Grafana Dashboards

Edit `demo/grafana/dashboards/risk-brain-demo.json` or add new dashboard JSON files to the same directory.

### Add Prometheus Exporters

Edit `demo/prometheus/prometheus.yml` to add new scrape targets:

```yaml
scrape_configs:
  - job_name: "my-service"
    static_configs:
      - targets: ["my-service:9100"]
```

---

## 🛠️ Troubleshooting

### UI not loading

**Check logs:**
```bash
docker compose -f docker-compose.demo.yml logs ui
```

**Common issues:**
- npm install failed → Delete `apps/risk-brain-ui/node_modules` and restart
- Port 3000 already in use → Stop other services using port 3000

### PDFs not loading

**Check logs:**
```bash
docker compose -f docker-compose.demo.yml logs ui-gateway
```

**Common issues:**
- PDF files not found → Verify PDFs exist in `apps/risk-brain-ui-gateway/demo-pdfs/`
- CORS errors → Verify UI Gateway is running on port 8080

### Grafana not loading

**Check logs:**
```bash
docker compose -f docker-compose.demo.yml logs grafana
```

**Common issues:**
- Port 3001 already in use → Stop other services using port 3001
- Dashboards not loading → Verify `demo/grafana/dashboards/risk-brain-demo.json` exists

---

## 🚀 Production Deployment

This Docker Compose stack is **demo-only**. For production deployment:

1. Replace mock UI Gateway with real Risk Brain Reporter API
2. Deploy to AWS ECS/Fargate or EKS
3. Configure Cognito for real authentication
4. Configure real Prometheus exporters for Risk Brain services
5. Configure real Grafana dashboards with production metrics

---

## 🏆 Strategic Value

**Zero Production Deployment Required:**
- ✅ No AWS, no Cognito, no cloud risk
- ✅ Fully regulator-demo safe (no live data, no credentials)
- ✅ Board-presentation ready (professional UI, real PDFs)
- ✅ Partner-demo ready (category-leading governance)
- ✅ Laptop-portable for on-site regulator meetings
- ✅ Offline-capable (no internet required after initial pull)

**This is NOT a prototype.** This is **production-grade governance UI** ready for:
- CU board demos
- APRA / AUSTRAC / ASIC pre-engagements
- Insurer underwriting presentations
- Partner technical demonstrations

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first board presentation
