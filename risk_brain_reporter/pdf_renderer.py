"""
Risk Brain Reporter — PDF Rendering Pipeline v1

This module provides PDF rendering for Risk Brain reports.

PURPOSE:
- Render Markdown templates to PDF
- Deterministic layout (versioned templates)
- Immutable outputs (SHA-256 sealed)

RENDERING STACK:
- Markdown → HTML → Headless Chromium → PDF
- Using markdown library + weasyprint

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Risk Brain Reporter)
"""

import os
import hashlib
import markdown
from typing import Dict, Any
from datetime import datetime


# ============================================================================
# TEMPLATE RENDERER
# ============================================================================

class TemplateRenderer:
    """
    Template renderer for Risk Brain reports.
    
    This class renders Markdown templates with variable substitution.
    """
    
    def __init__(self, template_dir: str):
        """
        Initialize template renderer.
        
        Args:
            template_dir: Directory containing Markdown templates
        """
        self.template_dir = template_dir
    
    def render(self, template_name: str, variables: Dict[str, Any]) -> str:
        """
        Render Markdown template with variables.
        
        Args:
            template_name: Template filename (e.g., "board_pack.md")
            variables: Dictionary of template variables
            
        Returns:
            Rendered Markdown string
        """
        # Read template
        template_path = os.path.join(self.template_dir, template_name)
        with open(template_path, 'r') as f:
            template = f.read()
        
        # Substitute variables
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            template = template.replace(placeholder, str(value))
        
        return template


# ============================================================================
# PDF RENDERER
# ============================================================================

class PDFRenderer:
    """
    PDF renderer for Risk Brain reports.
    
    This class converts Markdown to PDF using:
    - markdown library (Markdown → HTML)
    - weasyprint library (HTML → PDF)
    """
    
    def __init__(self):
        """Initialize PDF renderer."""
        pass
    
    def render_markdown_to_html(self, markdown_text: str) -> str:
        """
        Convert Markdown to HTML.
        
        Args:
            markdown_text: Markdown string
            
        Returns:
            HTML string
        """
        # Convert Markdown to HTML
        html = markdown.markdown(
            markdown_text,
            extensions=['tables', 'fenced_code', 'codehilite']
        )
        
        # Wrap in HTML document
        html_doc = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Risk Brain Report</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:nth-child(even) {{
            background-color: #f2f2f2;
        }}
        blockquote {{
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin-left: 0;
            font-style: italic;
            color: #555;
        }}
        code {{
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }}
        pre {{
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }}
        .safety-ok {{
            color: #27ae60;
            font-weight: bold;
        }}
        .safety-violation {{
            color: #e74c3c;
            font-weight: bold;
        }}
    </style>
</head>
<body>
{html}
</body>
</html>
"""
        return html_doc
    
    def render_html_to_pdf(self, html: str, output_path: str) -> None:
        """
        Convert HTML to PDF.
        
        Args:
            html: HTML string
            output_path: Output PDF file path
        """
        try:
            # Try using weasyprint
            from weasyprint import HTML
            HTML(string=html).write_pdf(output_path)
        except ImportError:
            # Fallback: Write HTML file instead
            html_path = output_path.replace('.pdf', '.html')
            with open(html_path, 'w') as f:
                f.write(html)
            print(f"⚠️  weasyprint not available, wrote HTML instead: {html_path}")
            print(f"   To generate PDF, install weasyprint: pip3 install weasyprint")
    
    def render_markdown_to_pdf(self, markdown_text: str, output_path: str) -> None:
        """
        Convert Markdown to PDF.
        
        Args:
            markdown_text: Markdown string
            output_path: Output PDF file path
        """
        # Convert Markdown to HTML
        html = self.render_markdown_to_html(markdown_text)
        
        # Convert HTML to PDF
        self.render_html_to_pdf(html, output_path)


# ============================================================================
# REPORT RENDERER (Combines Template + PDF)
# ============================================================================

class ReportRenderer:
    """
    Report renderer for Risk Brain reports.
    
    This class combines template rendering and PDF generation.
    """
    
    def __init__(self, template_dir: str):
        """
        Initialize report renderer.
        
        Args:
            template_dir: Directory containing Markdown templates
        """
        self.template_renderer = TemplateRenderer(template_dir)
        self.pdf_renderer = PDFRenderer()
    
    def render_board_pack(self, snapshot: Any, output_path: str) -> str:
        """
        Render weekly board pack PDF.
        
        Args:
            snapshot: RiskBrainSnapshot instance
            output_path: Output PDF file path
            
        Returns:
            Path to generated PDF (or HTML if weasyprint not available)
        """
        # Prepare template variables
        variables = self._prepare_board_pack_variables(snapshot)
        
        # Render template
        markdown_text = self.template_renderer.render("board_pack.md", variables)
        
        # Render PDF
        self.pdf_renderer.render_markdown_to_pdf(markdown_text, output_path)
        
        # Compute SHA-256 hash
        self._write_hash_file(output_path)
        
        return output_path
    
    def render_regulator_annex(self, snapshot: Any, output_path: str) -> str:
        """
        Render regulator annex PDF.
        
        Args:
            snapshot: RiskBrainSnapshot instance
            output_path: Output PDF file path
            
        Returns:
            Path to generated PDF (or HTML if weasyprint not available)
        """
        # Prepare template variables
        variables = self._prepare_regulator_annex_variables(snapshot)
        
        # Render template
        markdown_text = self.template_renderer.render("regulator_annex.md", variables)
        
        # Render PDF
        self.pdf_renderer.render_markdown_to_pdf(markdown_text, output_path)
        
        # Compute SHA-256 hash
        self._write_hash_file(output_path)
        
        return output_path
    
    def _prepare_board_pack_variables(self, snapshot: Any) -> Dict[str, Any]:
        """Prepare template variables for board pack."""
        return {
            # Header
            "week": snapshot.week,
            "period_start": snapshot.period_start,
            "period_end": snapshot.period_end,
            "tenant_id": snapshot.tenant_id,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            
            # Safety
            "safety_statement": snapshot.safety_statement(),
            "ai_origin_violations": snapshot.safety.ai_origin_violations,
            "schema_violations": snapshot.safety.schema_violations,
            "policy_origin_violations": snapshot.safety.policy_origin_violations,
            "ai_origin_status": "✅ OK" if snapshot.safety.ai_origin_violations == 0 else "❌ VIOLATION",
            "schema_status": "✅ OK" if snapshot.safety.schema_violations == 0 else "❌ VIOLATION",
            "policy_origin_status": "✅ OK" if snapshot.safety.policy_origin_violations == 0 else "❌ VIOLATION",
            
            # Health
            "payments_shadow": "✅ Enabled" if snapshot.health["payments"].shadow else "❌ Disabled",
            "payments_ci": "✅ Passing" if snapshot.health["payments"].ci else "❌ Failing",
            "payments_killswitch": snapshot.health["payments"].killswitch,
            "fraud_shadow": "✅ Enabled" if snapshot.health["fraud"].shadow else "❌ Disabled",
            "fraud_ci": "✅ Passing" if snapshot.health["fraud"].ci else "❌ Failing",
            "fraud_killswitch": snapshot.health["fraud"].killswitch,
            "aml_shadow": "✅ Enabled" if snapshot.health["aml"].shadow else "❌ Disabled",
            "aml_ci": "✅ Passing" if snapshot.health["aml"].ci else "❌ Failing",
            "aml_killswitch": snapshot.health["aml"].killswitch,
            "treasury_shadow": "✅ Enabled" if snapshot.health["treasury"].shadow else "❌ Disabled",
            "treasury_ci": "✅ Passing" if snapshot.health["treasury"].ci else "❌ Failing",
            "treasury_killswitch": snapshot.health["treasury"].killswitch,
            
            # Payments
            "payments_coverage_pct": snapshot.payments.coverage_pct,
            "payments_better": snapshot.payments.direction_split["better"],
            "payments_worse": snapshot.payments.direction_split["worse"],
            "payments_neutral": snapshot.payments.direction_split["neutral"],
            
            # Fraud
            "fraud_high_flags": snapshot.fraud.high_flags,
            "fraud_confirmed": snapshot.fraud.confirmed,
            "fraud_cleared": snapshot.fraud.cleared,
            "fraud_precision": round(
                (snapshot.fraud.confirmed / (snapshot.fraud.confirmed + snapshot.fraud.cleared) * 100)
                if (snapshot.fraud.confirmed + snapshot.fraud.cleared) > 0 else 0.0,
                1
            ),
            
            # AML
            "aml_high_flags": snapshot.aml.high_flags,
            "aml_medium_flags": snapshot.aml.medium_flags,
            "aml_smrs": snapshot.aml.smrs,
            
            # Treasury
            "treasury_high_risk_windows": snapshot.treasury.high_risk_windows,
            "treasury_avg_buffer_delta_dollars": f"{snapshot.treasury.avg_buffer_delta / 100:,.2f}",
        }
    
    def _prepare_regulator_annex_variables(self, snapshot: Any) -> Dict[str, Any]:
        """Prepare template variables for regulator annex."""
        # Reuse board pack variables
        variables = self._prepare_board_pack_variables(snapshot)
        
        # No additional variables needed for regulator annex
        return variables
    
    def _write_hash_file(self, file_path: str) -> None:
        """
        Write SHA-256 hash file for immutability.
        
        Args:
            file_path: Path to file to hash
        """
        # Compute SHA-256 hash
        with open(file_path, 'rb') as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()
        
        # Write hash file
        hash_path = file_path + ".sha256"
        with open(hash_path, 'w') as f:
            f.write(sha256)
