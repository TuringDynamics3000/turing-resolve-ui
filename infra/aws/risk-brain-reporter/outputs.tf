# Risk Brain Reporter — Terraform Outputs
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

output "s3_bucket_name" {
  description = "S3 bucket name for risk brain reports"
  value       = aws_s3_bucket.risk_brain_reports.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.risk_brain_reports.arn
}

output "iam_role_arn" {
  description = "IAM role ARN for Risk Brain Reporter"
  value       = aws_iam_role.reporter_role.arn
}

output "iam_role_name" {
  description = "IAM role name"
  value       = aws_iam_role.reporter_role.name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = var.namespace
}

output "service_account_name" {
  description = "Kubernetes service account name"
  value       = "risk-brain-reporter-sa"
}
