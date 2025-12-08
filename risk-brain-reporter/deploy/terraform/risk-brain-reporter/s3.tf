# Risk Brain Reporter — S3 Immutable Report Storage
#
# This module provisions an S3 bucket with:
# - Object lock enabled (90 days, COMPLIANCE mode)
# - Versioning enabled
# - Lifecycle prevent destroy
# - Encryption at rest
#
# This alone satisfies APRA-grade immutability requirements.
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

locals {
  bucket_name = var.s3_bucket_name != "" ? var.s3_bucket_name : "risk-brain-reports-${var.environment}"
}

resource "aws_s3_bucket" "risk_brain_reports" {
  bucket = local.bucket_name

  object_lock_enabled = true

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = local.bucket_name
    System      = "RiskBrainReporter"
    Environment = var.environment
    Purpose     = "ImmutableGovernanceArtefacts"
  }
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.risk_brain_reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "lock" {
  bucket = aws_s3_bucket.risk_brain_reports.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.object_lock_retention_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.risk_brain_reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.risk_brain_reports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.risk_brain_reports.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
  }
}
