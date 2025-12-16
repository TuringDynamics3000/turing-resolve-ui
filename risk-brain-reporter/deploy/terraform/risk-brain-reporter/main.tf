# Risk Brain Reporter — Terraform Main Configuration
#
# This module provisions the infrastructure for Risk Brain Reporter:
# - S3 bucket with object lock (90 days, COMPLIANCE mode)
# - IAM role with least privilege (read-only metrics, write-only S3)
# - EKS namespace and service account (IRSA)
# - Secrets management
#
# Author: TuringCore National Infrastructure Team
# Version: 1.0
# Status: Production-Ready

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  backend "s3" {
    bucket         = "turingcore-terraform-state"
    key            = "risk-brain-reporter/terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      System      = "RiskBrainReporter"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = "RiskBrain"
    }
  }
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

# Data sources
data "aws_eks_cluster" "cluster" {
  name = var.eks_cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = var.eks_cluster_name
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
