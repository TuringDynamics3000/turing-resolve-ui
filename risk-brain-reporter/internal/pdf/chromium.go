// Risk Brain Reporter — PDF Renderer (Headless Chromium)
//
// This module renders PDFs from Markdown using headless Chromium.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package pdf

import (
	"fmt"
	"os"
	"os/exec"
)

// RenderMarkdownToPDF renders Markdown to PDF using headless Chromium.
func RenderMarkdownToPDF(markdown []byte) ([]byte, error) {
	// For v1, use manus-md-to-pdf utility
	// In production, this would use headless Chromium container via local socket

	// Write markdown to temp file
	tmpFile, err := os.CreateTemp("", "board-pack-*.md")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(markdown); err != nil {
		return nil, fmt.Errorf("failed to write markdown: %w", err)
	}
	tmpFile.Close()

	// Render PDF
	pdfFile := tmpFile.Name() + ".pdf"
	defer os.Remove(pdfFile)

	cmd := exec.Command("manus-md-to-pdf", tmpFile.Name(), pdfFile)
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to render PDF: %w", err)
	}

	// Read PDF
	pdfBytes, err := os.ReadFile(pdfFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDF: %w", err)
	}

	return pdfBytes, nil
}
