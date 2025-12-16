// Risk Brain Reporter — Weekly Batch Job
//
// This is the main entry point for the weekly board pack generation job.
// It runs every Sunday at 23:00 UTC to generate weekly board packs for all tenants.
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
	"fmt"
	"log"
	"os"
	"time"

	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/metrics"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/renderer"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/snapshot"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/storage"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/telemetry"
)

func main() {
	log.Println("🚀 Risk Brain Reporter — Weekly Batch Job")
	log.Println("Starting weekly board pack generation...")

	ctx := context.Background()

	// Initialize telemetry
	telemetry.Init()
	defer telemetry.Shutdown()

	// Resolve current week
	week := snapshot.ResolveWeek(time.Now())
	log.Printf("📅 Generating reports for week: %s", week)

	// Load tenants
	tenants := snapshot.LoadTenants()
	log.Printf("👥 Found %d tenants", len(tenants))

	// Initialize metrics client
	metricsClient, err := metrics.NewClient(os.Getenv("PROMETHEUS_URL"))
	if err != nil {
		log.Fatalf("❌ Failed to initialize metrics client: %v", err)
	}

	// Initialize storage client
	storageClient, err := storage.NewS3Client(ctx, os.Getenv("S3_BUCKET"))
	if err != nil {
		log.Fatalf("❌ Failed to initialize storage client: %v", err)
	}

	// Generate reports for each tenant
	successCount := 0
	failureCount := 0

	for _, tenant := range tenants {
		log.Printf("📊 Processing tenant: %s", tenant)

		// Build canonical risk snapshot
		csr, err := snapshot.Build(ctx, metricsClient, tenant, week)
		if err != nil {
			log.Printf("❌ Failed to build snapshot for tenant %s: %v", tenant, err)
			failureCount++
			telemetry.RecordReportFailure(tenant, week, "snapshot_build_failed")
			continue
		}

		// Validate snapshot
		if err := snapshot.Validate(csr); err != nil {
			log.Printf("❌ Snapshot validation failed for tenant %s: %v", tenant, err)
			failureCount++
			telemetry.RecordReportFailure(tenant, week, "snapshot_validation_failed")
			continue
		}

		// Safety check: AI origin violations MUST be 0
		if csr.Safety.AIOriginViolations > 0 {
			log.Printf("🚨 FATAL: AI origin violations detected for tenant %s: %d", tenant, csr.Safety.AIOriginViolations)
			failureCount++
			telemetry.RecordReportFailure(tenant, week, "ai_origin_violation")
			continue
		}

		// Render board pack PDF
		pdf, err := renderer.RenderBoardPack(csr)
		if err != nil {
			log.Printf("❌ Failed to render board pack for tenant %s: %v", tenant, err)
			failureCount++
			telemetry.RecordReportFailure(tenant, week, "render_failed")
			continue
		}

		// Write immutable weekly report
		if err := storageClient.WriteImmutableWeekly(ctx, pdf, tenant, week); err != nil {
			log.Printf("❌ Failed to write report for tenant %s: %v", tenant, err)
			failureCount++
			telemetry.RecordReportFailure(tenant, week, "storage_write_failed")
			continue
		}

		log.Printf("✅ Successfully generated report for tenant: %s", tenant)
		successCount++
		telemetry.RecordReportSuccess(tenant, week)
	}

	// Summary
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Printf("📈 Weekly report generation complete")
	log.Printf("✅ Success: %d", successCount)
	log.Printf("❌ Failure: %d", failureCount)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if failureCount > 0 {
		os.Exit(1)
	}
}
