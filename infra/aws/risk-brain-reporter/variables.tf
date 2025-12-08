# Risk Brain Reporter — Terraform Variables
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-2"
}

variable "eks_cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "s3_bucket_name" {
  description = "S3 bucket name for risk brain reports"
  type        = string
  default     = ""
}

variable "object_lock_retention_days" {
  description = "Object lock retention period (days)"
  type        = number
  default     = 90
}

variable "prometheus_url" {
  description = "Prometheus query URL"
  type        = string
  sensitive   = true
}

variable "reporter_image" {
  description = "Risk Brain Reporter Docker image"
  type        = string
  default     = "risk-brain-reporter:latest"
}

variable "cronjob_schedule" {
  description = "CronJob schedule for weekly reports"
  type        = string
  default     = "0 23 * * 0" # Sunday 23:00 UTC
}

variable "api_replicas" {
  description = "Number of API replicas"
  type        = number
  default     = 2
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "risk-brain-reporter"
}

variable "vpc_cidr" {
  description = "VPC CIDR block for Prometheus access"
  type        = string
  default     = "10.0.0.0/16"
}

variable "s3_cidr" {
  description = "S3 CIDR block"
  type        = string
  default     = "52.216.0.0/15"
}
