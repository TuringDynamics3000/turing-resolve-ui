// Risk Brain Reporter — Regulator Pack Renderer
//
// This module renders regulator pack PDFs from canonical risk snapshots.
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

//go:embed templates/regulator.md.tmpl
var regulatorTemplate string

type RegulatorPackData struct {
	*snapshot.CanonicalRiskSnapshot
	IncludeEventSamples bool
}

// RenderRegulatorPack renders a regulator pack PDF from a canonical risk snapshot.
func RenderRegulatorPack(csr *snapshot.CanonicalRiskSnapshot, includeEventSamples bool) ([]byte, error) {
	// Parse template
	tmpl, err := template.New("regulator").Parse(regulatorTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse regulator template: %w", err)
	}

	// Prepare data
	data := RegulatorPackData{
		CanonicalRiskSnapshot: csr,
		IncludeEventSamples:   includeEventSamples,
	}

	// Execute template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("failed to execute regulator template: %w", err)
	}

	// Render PDF
	pdfBytes, err := pdf.RenderMarkdownToPDF(buf.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to render PDF: %w", err)
	}

	return pdfBytes, nil
}
