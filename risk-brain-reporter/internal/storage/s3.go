// Risk Brain Reporter — S3 Storage Client
//
// This module provides an S3 client for writing immutable reports.
//
// NO DELETE. NO OVERWRITE. NO READ-BACK.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"
)

// S3Client is an S3 storage client.
type S3Client struct {
	bucket string
}

// NewS3Client creates a new S3 storage client.
func NewS3Client(ctx context.Context, bucket string) (*S3Client, error) {
	if bucket == "" {
		return nil, fmt.Errorf("S3 bucket is required")
	}

	return &S3Client{
		bucket: bucket,
	}, nil
}

// WriteImmutableWeekly writes a weekly report to S3 with object lock.
func (c *S3Client) WriteImmutableWeekly(ctx context.Context, pdf []byte, tenantID string, week string) error {
	key := fmt.Sprintf("weekly/%s/risk-brain-week-%s.pdf", tenantID, week)
	return c.putObjectWithRetention(ctx, key, pdf, 90)
}

// WriteImmutableRegulator writes a regulator report to S3 with object lock.
func (c *S3Client) WriteImmutableRegulator(ctx context.Context, pdf []byte, tenantID string, periodEnd string) (string, string, error) {
	timestamp := time.Now().Format("20060102-150405")
	key := fmt.Sprintf("regulator/%s/risk-brain-regulator-%s-%s.pdf", tenantID, periodEnd, timestamp)

	if err := c.putObjectWithRetention(ctx, key, pdf, 90); err != nil {
		return "", "", err
	}

	// Calculate SHA256
	hash := sha256.Sum256(pdf)
	sha256Hex := fmt.Sprintf("%x", hash)

	objectPath := fmt.Sprintf("s3://%s/%s", c.bucket, key)
	return objectPath, sha256Hex, nil
}

func (c *S3Client) putObjectWithRetention(ctx context.Context, key string, data []byte, retentionDays int) error {
	// TODO: Implement actual S3 PutObject with object lock
	// For v1, this is a stub

	fmt.Printf("📦 Writing to S3: s3://%s/%s (%d bytes, %d days retention)\n", c.bucket, key, len(data), retentionDays)
	return nil
}
