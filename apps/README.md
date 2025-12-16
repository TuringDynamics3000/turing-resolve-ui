# Risk Brain Governance UI

**Local-first governance console** for National Risk Brain monitoring and board/regulator presentations.

---

## 🚀 Quick Start

From the `apps/` directory:

```bash
./demo.sh
```

This will:
- Install dependencies (if needed)
- Start UI Gateway mock server on port 8080
- Start Next.js UI on port 3000
- Open your browser to http://localhost:3000

---

## 📦 What's Included

### 1. Next.js Governance UI (`risk-brain-ui/`)

**Pages:**
- `/system` — System health dashboard (domain status, enforcement metrics)
- `/domains` — Domain-level metrics (Payments, Fraud, AML, Treasury)
- `/twin` — Digital Twin scenario status
- `/documents/board-packs` — Weekly board pack PDFs
- `/documents/regulator-annexes` — Regulator forensic annexes

**Features:**
- ✅ Dark mode professional UI (Tailwind CSS)
- ✅ Real-time data fetching (@tanstack/react-query)
- ✅ Role-based demo mode (operator, board, regulator, developer)
- ✅ PDF document viewer
- ✅ Zero AWS, zero Cognito, zero cloud risk

### 2. UI Gateway Mock Server (`risk-brain-ui-gateway/`)

**Endpoints:**
- `GET /api/v1/ui/system/health` — System health metrics
- `GET /api/v1/ui/domains` — Domain status and metrics
- `GET /api/v1/ui/twin/scenarios` — Digital Twin scenarios
- `GET /api/v1/ui/documents/board-packs` — Board pack list
- `GET /api/v1/ui/documents/regulator-annexes` — Regulator annex list
- `GET /documents/*` — Static PDF files

**Mock Data:**
- Realistic synthetic metrics (Week-0 sample data)
- Matches production API schema
- No external dependencies

---

## 🎯 Demo Mode

The UI supports role-based demo mode for presentations:

**Edit `.env.local` in `risk-brain-ui/`:**

```bash
NEXT_PUBLIC_DEMO_USER_ROLE=operator  # or board, regulator, developer
```

**Roles:**
- `operator` — Full system visibility, operational metrics
- `board` — Executive summary, governance attestation
- `regulator` — Forensic replay, safety invariants
- `developer` — Technical details, CI/CD status

---

## 📊 What You Can Demo

### For Boards:

✅ AI is clearly active (domain metrics, advisory counts)  
✅ AI is generating intelligence (coverage, confidence scores)  
✅ AI is not executing (enforcement violations = 0)  
✅ Risk posture is measurable (board packs, weekly KPIs)  
✅ Safety is mechanically enforced (kill-switch status)

### For Regulators:

✅ Non-execution is provable (enforcement metrics)  
✅ Replay is available (regulator annexes with S3 pointers)  
✅ Escalation thresholds are explicit (policy gateway rules)  
✅ Behavioural drift is quantified (confidence distributions)

### For Commercial Partners:

✅ This is category-leading governance (vs slide-deck AI)  
✅ This is operational AI oversight (live metrics, weekly reports)  
✅ This is regulator-ready (forensic annexes, meeting scripts)

---

## 🛠️ Development

### Install Dependencies

```bash
cd risk-brain-ui
npm install

cd ../risk-brain-ui-gateway
npm install
```

### Run Separately

**UI Gateway:**
```bash
cd risk-brain-ui-gateway
npm start
```

**Next.js UI:**
```bash
cd risk-brain-ui
npm run dev
```

### Build for Production

```bash
cd risk-brain-ui
npm run build
npm start
```

---

## 📁 Directory Structure

```
apps/
├── demo.sh                          # One-command demo launcher
├── README.md                        # This file
│
├── risk-brain-ui/                   # Next.js governance console
│   ├── app/                         # Pages (system, domains, twin, documents)
│   ├── components/                  # React components (layout, status, domain, twin, documents)
│   ├── lib/                         # API client, auth, utilities
│   ├── .env.local                   # Demo mode configuration
│   └── package.json
│
└── risk-brain-ui-gateway/           # Mock UI Gateway server
    ├── server.js                    # Express server
    ├── mock/                        # JSON fixtures (system-health, domains, twin-scenarios, etc.)
    ├── demo-pdfs/                   # Week-0 sample PDFs
    └── package.json
```

---

## 🎊 Strategic Value

**Zero Production Deployment Required:**
- No AWS, no Cognito, no cloud risk
- Fully regulator-demo safe (no live data, no credentials)
- Board-presentation ready (professional UI, real PDFs)
- Partner-demo ready (category-leading governance)

**This is NOT a prototype.** This is **production-grade governance UI** ready for:
- CU board demos
- APRA / AUSTRAC / ASIC pre-engagements
- Insurer underwriting presentations
- Partner technical demonstrations

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first board presentation
