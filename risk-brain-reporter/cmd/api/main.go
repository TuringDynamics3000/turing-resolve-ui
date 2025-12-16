// Risk Brain Reporter — On-Demand API
//
// This is the main entry point for the on-demand regulator annex generation API.
// It provides REST API endpoints for generating regulator annexes on demand.
//
// RESPONSIBILITIES:
// ✅ Pull metrics from Prometheus
// ✅ Aggregate into canonical snapshot
// ✅ Render PDFs
// ✅ Write immutable artefacts
// ✅ Emit telemetry
//
// NEVER ALLOWED:
// ❌ Emit commands
// ❌ Touch ledgers
// ❌ Influence runtime policy
// ❌ Call Kafka producers
// ❌ Interact with A-domain APIs
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/metrics"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/renderer"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/snapshot"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/storage"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/telemetry"
)

type RegulatorRequest struct {
	PeriodStart         string `json:"period_start"`
	PeriodEnd           string `json:"period_end"`
	IncludeEventSamples bool   `json:"include_event_samples"`
}

type RegulatorResponse struct {
	Status     string `json:"status"`
	TenantID   string `json:"tenant_id"`
	ObjectPath string `json:"object_path"`
	SHA256     string `json:"sha256"`
}

var (
	metricsClient *metrics.Client
	storageClient *storage.S3Client
)

func main() {
	log.Println("🚀 Risk Brain Reporter — On-Demand API")
	log.Println("Starting API server...")

	ctx := context.Background()

	// Initialize telemetry
	telemetry.Init()
	defer telemetry.Shutdown()

	// Initialize metrics client
	var err error
	metricsClient, err = metrics.NewClient(os.Getenv("PROMETHEUS_URL"))
	if err != nil {
		log.Fatalf("❌ Failed to initialize metrics client: %v", err)
	}

	// Initialize storage client
	storageClient, err = storage.NewS3Client(ctx, os.Getenv("S3_BUCKET"))
	if err != nil {
		log.Fatalf("❌ Failed to initialize storage client: %v", err)
	}

	// Register handlers
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/v1/reports/regulator/run/", regulatorHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("✅ API server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "risk-brain-reporter",
		"version": "1.0.0",
	})
}

func regulatorHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract tenant ID from URL path
	tenantID := r.URL.Path[len("/api/v1/reports/regulator/run/"):]
	if tenantID == "" {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	// Parse request
	var req RegulatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate dates
	periodStart, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		http.Error(w, "Invalid period_start format", http.StatusBadRequest)
		return
	}

	periodEnd, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		http.Error(w, "Invalid period_end format", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	log.Printf("📊 Generating regulator annex for tenant: %s (period: %s to %s)", tenantID, req.PeriodStart, req.PeriodEnd)

	// Build canonical risk snapshot for period
	csr, err := snapshot.BuildForPeriod(ctx, metricsClient, tenantID, periodStart, periodEnd)
	if err != nil {
		log.Printf("❌ Failed to build snapshot for tenant %s: %v", tenantID, err)
		http.Error(w, "Failed to build snapshot", http.StatusInternalServerError)
		telemetry.RecordReportFailure(tenantID, req.PeriodEnd, "snapshot_build_failed")
		return
	}

	// Validate snapshot
	if err := snapshot.Validate(csr); err != nil {
		log.Printf("❌ Snapshot validation failed for tenant %s: %v", tenantID, err)
		http.Error(w, "Snapshot validation failed", http.StatusInternalServerError)
		telemetry.RecordReportFailure(tenantID, req.PeriodEnd, "snapshot_validation_failed")
		return
	}

	// Safety check: AI origin violations MUST be 0
	if csr.Safety.AIOriginViolations > 0 {
		log.Printf("🚨 FATAL: AI origin violations detected for tenant %s: %d", tenantID, csr.Safety.AIOriginViolations)
		http.Error(w, "AI origin violations detected", http.StatusInternalServerError)
		telemetry.RecordReportFailure(tenantID, req.PeriodEnd, "ai_origin_violation")
		return
	}

	// Render regulator pack PDF
	pdf, err := renderer.RenderRegulatorPack(csr, req.IncludeEventSamples)
	if err != nil {
		log.Printf("❌ Failed to render regulator pack for tenant %s: %v", tenantID, err)
		http.Error(w, "Failed to render regulator pack", http.StatusInternalServerError)
		telemetry.RecordReportFailure(tenantID, req.PeriodEnd, "render_failed")
		return
	}

	// Write immutable regulator report
	objectPath, sha256, err := storageClient.WriteImmutableRegulator(ctx, pdf, tenantID, req.PeriodEnd)
	if err != nil {
		log.Printf("❌ Failed to write report for tenant %s: %v", tenantID, err)
		http.Error(w, "Failed to write report", http.StatusInternalServerError)
		telemetry.RecordReportFailure(tenantID, req.PeriodEnd, "storage_write_failed")
		return
	}

	log.Printf("✅ Successfully generated regulator annex for tenant: %s", tenantID)
	telemetry.RecordReportSuccess(tenantID, req.PeriodEnd)

	// Return response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RegulatorResponse{
		Status:     "STORED_IMMUTABLY",
		TenantID:   tenantID,
		ObjectPath: objectPath,
		SHA256:     sha256,
	})
}
