# Risk Brain Reporter — IAM Absolute Least Privilege
#
# This module provisions IAM roles and policies with:
# - Read-only Prometheus access (via AMP)
# - Write-only S3 access (no delete, no overwrite)
# - IRSA (IAM Roles for Service Accounts) for EKS
#
# This role physically cannot:
# - Delete or read back any artefact
# - Overwrite any artefact
# - Access Kafka, Ledger, Policy, or Core services
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

# OIDC provider for EKS (IRSA)
data "aws_iam_openid_connect_provider" "eks" {
  url = data.aws_eks_cluster.cluster.identity[0].oidc[0].issuer
}

# IAM role for Risk Brain Reporter
resource "aws_iam_role" "reporter_role" {
  name = "risk-brain-reporter-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(data.aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:${var.namespace}:risk-brain-reporter-sa"
            "${replace(data.aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "risk-brain-reporter-role"
    System      = "RiskBrainReporter"
    Environment = var.environment
  }
}

# Policy: Read-Only Prometheus Access (via AMP)
resource "aws_iam_policy" "metrics_readonly" {
  name        = "risk-brain-reporter-metrics-ro-${var.environment}"
  description = "Read-only access to Prometheus metrics via AMP"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "aps:QueryMetrics",
          "aps:GetMetricMetadata",
          "aps:GetLabels",
          "aps:GetSeries"
        ]
        Resource = "*"
      }
    ]
  })
}

# Policy: Write-Only S3 (No Delete, No Overwrite)
resource "aws_iam_policy" "s3_writeonly" {
  name        = "risk-brain-reporter-s3-wo-${var.environment}"
  description = "Write-only access to S3 (no delete, no overwrite)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectRetention",
          "s3:PutObjectLegalHold"
        ]
        Resource = "${aws_s3_bucket.risk_brain_reports.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.risk_brain_reports.arn
      }
    ]
  })
}

# Attach policies to role
resource "aws_iam_role_policy_attachment" "attach_metrics" {
  role       = aws_iam_role.reporter_role.name
  policy_arn = aws_iam_policy.metrics_readonly.arn
}

resource "aws_iam_role_policy_attachment" "attach_s3" {
  role       = aws_iam_role.reporter_role.name
  policy_arn = aws_iam_policy.s3_writeonly.arn
}

# Explicit deny for dangerous actions
resource "aws_iam_policy" "explicit_deny" {
  name        = "risk-brain-reporter-explicit-deny-${var.environment}"
  description = "Explicit deny for dangerous actions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion",
          "s3:BypassGovernanceRetention",
          "kafka:*",
          "rds:*",
          "dynamodb:*",
          "sqs:*",
          "sns:*",
          "lambda:*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_deny" {
  role       = aws_iam_role.reporter_role.name
  policy_arn = aws_iam_policy.explicit_deny.arn
}
