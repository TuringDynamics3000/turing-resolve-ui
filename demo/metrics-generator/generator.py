#!/usr/bin/env python3
"""
Synthetic Risk Brain Metrics Generator

Generates realistic Prometheus metrics for Risk Brain domains with
live demo traffic presets (quiet, normal, stressed, crisis).

Control API:
  GET  /mode         - Get current mode
  POST /mode/<name>  - Set mode (quiet, normal, stressed, crisis)

Metrics exported on port 9100 (Prometheus format)
Control API on port 9200 (Flask HTTP)
"""

from prometheus_client import start_http_server, Counter, Gauge
from flask import Flask, request, jsonify
import threading
import random
import time

# -----------------------------
# PROMETHEUS METRICS
# -----------------------------

payments_rl_eval = Counter(
    "payments_rl_policy_evaluated_total",
    "Number of payments evaluated by RL"
)

fraud_flags = Counter(
    "fraud_risk_flag_raised_total",
    "Fraud risk flags raised",
    ["risk_band"]
)

aml_flags = Counter(
    "aml_risk_flag_raised_total",
    "AML risk flags raised",
    ["risk_band"]
)

treasury_advisory = Counter(
    "treasury_risk_advisories_total",
    "Treasury risk advisories",
    ["risk_band"]
)

ai_origin_violations = Gauge(
    "risk_brain_ai_origin_block_violations_total",
    "AI execution block violations (MUST BE 0)"
)

schema_violations = Gauge(
    "risk_brain_schema_version_violations_total",
    "Schema version violations (MUST BE 0)"
)

# -----------------------------
# DEMO TRAFFIC MODES
# -----------------------------

MODES = {
    "quiet": {
        "rate": 5,
        "fraud": 0.02,
        "aml": 0.01,
        "treasury": 0.01,
        "description": "Overnight / sleepy CU"
    },
    "normal": {
        "rate": 15,
        "fraud": 0.10,
        "aml": 0.05,
        "treasury": 0.05,
        "description": "Business as usual"
    },
    "stressed": {
        "rate": 40,
        "fraud": 0.30,
        "aml": 0.20,
        "treasury": 0.25,
        "description": "Retail panic / fraud wave"
    },
    "crisis": {
        "rate": 90,
        "fraud": 0.70,
        "aml": 0.50,
        "treasury": 0.60,
        "description": "Liquidity shock / cyber event"
    }
}

CURRENT_MODE = {"name": "normal"}

# -----------------------------
# FLASK CONTROL PLANE
# -----------------------------

app = Flask(__name__)

@app.route("/mode", methods=["GET"])
def get_mode():
    """Get current demo traffic mode"""
    mode_name = CURRENT_MODE["name"]
    return jsonify({
        "mode": mode_name,
        "description": MODES[mode_name]["description"],
        "config": MODES[mode_name]
    })

@app.route("/mode/<name>", methods=["POST"])
def set_mode(name):
    """Set demo traffic mode"""
    if name not in MODES:
        return jsonify({
            "error": "invalid mode",
            "valid_modes": list(MODES.keys())
        }), 400
    
    CURRENT_MODE["name"] = name
    print(f"⚡ Demo mode switched to: {name.upper()} - {MODES[name]['description']}")
    
    return jsonify({
        "mode": name,
        "description": MODES[name]["description"],
        "config": MODES[name]
    })

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "mode": CURRENT_MODE["name"]})

# -----------------------------
# METRICS LOOP THREAD
# -----------------------------

def metrics_loop():
    """Generate synthetic metrics based on current mode"""
    print("✅ Metrics generation loop started")
    
    while True:
        mode = MODES[CURRENT_MODE["name"]]

        # Payments RL volume
        payments_count = random.randint(
            max(0, mode["rate"] - 5),
            mode["rate"] + 5
        )
        payments_rl_eval.inc(payments_count)

        # Fraud flags
        if random.random() < mode["fraud"]:
            fraud_flags.labels("HIGH").inc(random.randint(3, 10))
        else:
            fraud_flags.labels("MEDIUM").inc(random.randint(1, 3))

        # AML flags
        if random.random() < mode["aml"]:
            aml_flags.labels("HIGH").inc(random.randint(1, 4))
        else:
            aml_flags.labels("MEDIUM").inc(random.randint(1, 2))

        # Treasury advisories
        if random.random() < mode["treasury"]:
            treasury_advisory.labels("HIGH").inc(random.randint(1, 3))
        else:
            treasury_advisory.labels("MEDIUM").inc(1)

        # SAFETY INVARIANTS (HARD ZERO - NEVER CHANGES)
        ai_origin_violations.set(0)
        schema_violations.set(0)

        time.sleep(5)  # Generate metrics every 5 seconds

# -----------------------------
# BOOT EVERYTHING
# -----------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("✅ Starting Synthetic Risk Brain Metrics Generator")
    print("=" * 60)
    print(f"📊 Prometheus metrics: http://0.0.0.0:9100/metrics")
    print(f"🎛️  Control API:       http://0.0.0.0:9200")
    print(f"🟢 Initial mode:       {CURRENT_MODE['name'].upper()}")
    print("=" * 60)

    # Start Prometheus exporter
    start_http_server(9100)
    print("✅ Prometheus exporter started on port 9100")

    # Start metrics generation thread
    metrics_thread = threading.Thread(target=metrics_loop, daemon=True)
    metrics_thread.start()
    print("✅ Metrics generation thread started")

    # Start Flask control plane
    print("✅ Starting Flask control plane on port 9200...")
    app.run(host="0.0.0.0", port=9200, debug=False)
