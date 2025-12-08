# Desktop App Setup — Windows One-Click Demo Launcher

**Transform the Risk Brain demo into a true desktop application** with one-click launch, cinematic boot sequence, and optional screen recording.

---

## 🎯 What This Creates

**Five Desktop "Apps":**

| Icon | Name | Script | Purpose |
|------|------|--------|---------|
| 🟢 | **Risk Brain Demo** | `RUN-DEMO.ps1` | One-click demo launch |
| 🎥 | **Risk Brain Demo (Recorded)** | `RUN-DEMO-RECORDED.ps1` | Launch + auto-record |
| 🔴 | **Crisis Mode** | `CRISIS-MODE.ps1` | Live crisis mode switch |
| 🛑 | **Stop Demo** | `STOP-DEMO.ps1` | Stop demo stack |
| 🛑 | **Stop Demo + Save Recording** | `STOP-DEMO-RECORDED.ps1` | Stop + save recording |

**All apps:**
- ✅ Use the Risk Brain pillar icon
- ✅ Are double-clickable (no terminal required)
- ✅ Are regulator-safe (no cloud, no credentials)
- ✅ Are laptop-portable (offline-capable)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Desktop Shortcuts

**For each script, create a desktop shortcut:**

1. Right-click on Desktop → **New** → **Shortcut**

2. **Target:**
   ```
   powershell.exe -ExecutionPolicy Bypass -File "C:\FULL\PATH\TO\REPO\RUN-DEMO.ps1"
   ```
   *(Replace with your actual repo path)*

3. **Name:** `Risk Brain Demo`

4. Click **Finish**

### Step 2: Attach the Risk Brain Icon

1. Right-click shortcut → **Properties**

2. Click **Change Icon**

3. Click **Browse** and navigate to:
   ```
   C:\FULL\PATH\TO\REPO\risk-brain.ico
   ```

4. Click **OK** → **Apply** → **OK**

### Step 3: Repeat for All Scripts

Create shortcuts for:
- `RUN-DEMO.ps1` → **Risk Brain Demo**
- `RUN-DEMO-RECORDED.ps1` → **Risk Brain Demo (Recorded)**
- `CRISIS-MODE.ps1` → **Crisis Mode**
- `STOP-DEMO.ps1` → **Stop Demo**
- `STOP-DEMO-RECORDED.ps1` → **Stop Demo + Save Recording**

---

## 🎬 What Happens When You Launch

### 1. Double-Click: Risk Brain Demo

**Cinematic boot sequence appears:**

```
RISK BRAIN
National Financial Governance Control Plane

⏳ UI Gateway Initialising…
⏳ Prometheus Initialising…
⏳ Grafana Initialising…
⏳ Synthetic Metrics Engine Initialising…

[Progress bar fills smoothly]

✅ All systems live — Launching Control Plane
```

**Screen fades out → Browser opens automatically to:**
```
http://localhost:3000
```

**You're now in the Risk Brain Governance UI.**

### 2. Mid-Demo: Double-Click Crisis Mode

**Instantly switches demo traffic to CRISIS mode:**
- Fraud flags explode
- AML high-risk dominates
- Treasury stress surges
- **Safety invariants still zero**

**Grafana updates within 5–10 seconds.**

### 3. End Demo: Double-Click Stop Demo

**Gracefully shuts down all containers:**
```
Stopping Risk Brain Demo Stack...

Demo fully stopped.
```

---

## 🎥 Optional: Screen Recording (Board Packs)

### One-Time Setup (5 Minutes)

**Install OBS Studio:**
1. Download: https://obsproject.com/
2. Install to default location: `C:\Program Files\obs-studio\`

**Create Demo Scene:**
1. Open OBS
2. Create new Scene: `Risk Brain Demo`
3. Add Source → **Display Capture**
4. Choose your main monitor
5. Save and close OBS

**That's it. You never touch OBS again.**

### Usage

**Start Recording + Demo:**
1. Double-click: **Risk Brain Demo (Recorded)**
2. Perform your demo walkthrough
3. Double-click: **Stop Demo + Save Recording**

**Your recording is saved to:**
```
/recordings/
  RiskBrain-Demo-2025-12-09_14-25-03.mp4
  RiskBrain-Demo-2025-12-09_15-11-41.mp4
```

**These files are:**
- ✅ Board-ready
- ✅ Regulator-ready
- ✅ Zoom-share-ready
- ✅ Email-ready
- ✅ YouTube/Vimeo-ready

**No editing required.**

---

## 🎯 Demo Choreography

### Recommended Meeting Flow

**1. Start Demo**
- Double-click: **Risk Brain Demo**
- Wait for cinematic boot
- Browser opens automatically

**2. Show Normal Operations**
- Navigate to **System** page
- Show domain health (all green)
- Navigate to **Domains** page
- Show Payments, Fraud, AML, Treasury metrics

**3. Switch to Crisis Mode (Live)**
- Double-click: **Crisis Mode** (separate desktop icon)
- Return to browser
- Navigate to **Domains** page
- Show metrics exploding (fraud, AML, treasury)
- Open Grafana: http://localhost:3001
- Show live dashboard updates

**4. Show Safety Invariants**
- Emphasize: **AI Origin Violations = 0**
- Emphasize: **Schema Violations = 0**
- Narrative: *"This is exactly the moment you never want an autonomous AI touching money. The Risk Brain is screaming, but it's still advisory-only. No execution authority."*

**5. Show Governance Artefacts**
- Navigate to **Board Packs**
- Click **View PDF** → Opens in-app
- Walk through executive summary, safety attestation
- Navigate to **Regulator Annexes**
- Click **View PDF** → Opens in-app
- Walk through regulatory assertion, replay pointers

**6. End Demo**
- Double-click: **Stop Demo**
- Demo gracefully shuts down

---

## 🏆 Strategic Value

**Application-Class Demo:**
- ✅ One-click launch (no terminal commands)
- ✅ Cinematic boot sequence (professional polish)
- ✅ Health-verified readiness (no "wait 30 seconds")
- ✅ Auto-open browser (no manual navigation)

**Regulator-Safe:**
- ✅ Zero cloud dependency
- ✅ Zero credentials required
- ✅ Laptop-portable
- ✅ Offline-capable

**Board-Grade:**
- ✅ Professional visual identity
- ✅ Controlled narrative progression
- ✅ Proof of AI non-execution
- ✅ Category-leading demo infrastructure

**This is exactly what APRA, AUSTRAC, and ASIC subconsciously test for:**

> "Can this actually operate like a real bank system without hand-waving?"

**You can now answer yes with a double-click.**

---

## 🚀 Next Steps

### Immediate (Today)

1. **Create Desktop Shortcuts**
   - Follow Step 1–3 above
   - Test each shortcut

2. **Test Cinematic Boot**
   - Double-click: **Risk Brain Demo**
   - Verify cinematic boot appears
   - Verify browser opens automatically

3. **Test Crisis Mode**
   - Double-click: **Crisis Mode**
   - Verify Grafana metrics update

### Short-Term (This Week)

4. **Practice Demo Choreography**
   - Run through full demo script
   - Practice crisis mode timing
   - Refine narrative for board/regulator presentations

5. **Optional: Test Screen Recording**
   - Install OBS Studio
   - Create demo scene
   - Test recording + playback

### Medium-Term (Next Month)

6. **Prepare Board Demo**
   - Use NORMAL → CRISIS progression
   - Emphasize safety invariants (always zero)
   - Record demo for distribution

7. **Prepare Regulator Pre-Engagement**
   - Use regulator annex walkthrough
   - Record demo for pre-read
   - Schedule pre-engagement meetings

---

## 🎊 Conclusion

**You now have a true desktop application** for the Risk Brain demo.

**This is NOT a prototype.** This is **application-class demo infrastructure**.

**Key Achievement:** You can hand this laptop to APRA, AUSTRAC, ASIC, CU Chairs, Insurers, or Investors — and they can operate it themselves.

**The Desktop App Setup is now complete and ready for immediate use!**

---

**Document Version:** 1.0  
**Last Updated:** 09 Dec 2025  
**Next Review:** After first board presentation
