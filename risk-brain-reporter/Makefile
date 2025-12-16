# Risk Brain Reporter — Makefile
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

.PHONY: build test docker helm terraform validate-templates validate-promql validate-s3-lock clean

build:
	@echo "🔨 Building binaries..."
	go build -o bin/weekly-job ./cmd/weekly-job
	go build -o bin/api ./cmd/api
	@echo "✅ Build complete"

test:
	@echo "🧪 Running tests..."
	go test ./test/...
	@echo "✅ Tests complete"

docker:
	@echo "🐳 Building Docker image..."
	docker build -t risk-brain-reporter:latest .
	@echo "✅ Docker image built"

helm:
	@echo "⎈ Installing Helm chart..."
	helm upgrade --install risk-brain-reporter deploy/helm/risk-brain-reporter
	@echo "✅ Helm chart installed"

terraform:
	@echo "🏗️  Applying Terraform..."
	cd deploy/terraform/risk-brain-reporter && terraform apply
	@echo "✅ Terraform applied"

validate-templates:
	@echo "📝 Validating templates..."
	@test -f internal/renderer/templates/board.md.tmpl || (echo "❌ Board template missing" && exit 1)
	@test -f internal/renderer/templates/regulator.md.tmpl || (echo "❌ Regulator template missing" && exit 1)
	@echo "✅ Templates validated"

validate-promql:
	@echo "📊 Validating PromQL manifest..."
	@test -f internal/config/promql-map-v1.yaml || (echo "❌ PromQL manifest missing" && exit 1)
	@echo "✅ PromQL manifest validated"

validate-s3-lock:
	@echo "🔒 Validating S3 lock configuration..."
	@grep -q "object_lock_enabled = true" deploy/terraform/risk-brain-reporter/s3.tf || (echo "❌ S3 object lock not enabled" && exit 1)
	@echo "✅ S3 lock validated"

clean:
	@echo "🧹 Cleaning..."
	rm -rf bin/
	@echo "✅ Clean complete"
