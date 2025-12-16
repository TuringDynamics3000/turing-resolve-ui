// Risk Brain Reporter — Board Pack Renderer
//
// This module renders board pack PDFs from canonical risk snapshots.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package renderer

import (
	_ "embed"
	"fmt"
	"text/template"
	"bytes"

	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/snapshot"
	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/pdf"
)

//go:embed templates/board.md.tmpl
var boardTemplate string

// RenderBoardPack renders a board pack PDF from a canonical risk snapshot.
func RenderBoardPack(csr *snapshot.CanonicalRiskSnapshot) ([]byte, error) {
	// Parse template
	tmpl, err := template.New("board").Parse(boardTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse board template: %w", err)
	}

	// Execute template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, csr); err != nil {
		return nil, fmt.Errorf("failed to execute board template: %w", err)
	}

	// Render PDF
	pdfBytes, err := pdf.RenderMarkdownToPDF(buf.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to render PDF: %w", err)
	}

	return pdfBytes, nil
}
