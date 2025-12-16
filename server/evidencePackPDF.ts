import PDFDocument from "pdfkit";
import type { Readable } from "stream";

interface EvidencePack {
  decisionId: string;
  decision: string;
  timestamp: Date;
  paymentFacts: any[];
  depositFacts: any[];
  auditFacts: any[];
  shadowAIAdvisories: any[];
}

export function generateEvidencePackPDF(evidencePack: EvidencePack): Readable {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // Title Page
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("TuringCore Evidence Pack", { align: "center" })
    .moveDown();

  doc
    .fontSize(12)
    .font("Helvetica")
    .text(`Decision ID: ${evidencePack.decisionId}`, { align: "center" })
    .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" })
    .moveDown(2);

  // Decision Summary
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("Decision Summary")
    .moveDown(0.5);

  doc
    .fontSize(11)
    .font("Helvetica")
    .text(`Decision: ${evidencePack.decision}`)
    .text(`Timestamp: ${new Date(evidencePack.timestamp).toLocaleString()}`)
    .moveDown();

  // Payment Facts
  if (evidencePack.paymentFacts.length > 0) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Payment Facts")
      .moveDown(0.5);

    evidencePack.paymentFacts.forEach((fact, idx) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${idx + 1}. ${fact.factType}`)
        .font("Helvetica")
        .text(`   Occurred At: ${new Date(fact.occurredAt).toLocaleString()}`)
        .text(`   Sequence: ${fact.sequence}`)
        .text(`   Idempotency Key: ${fact.idempotencyKey}`)
        .moveDown(0.3);
    });
    doc.moveDown();
  }

  // Deposit Facts
  if (evidencePack.depositFacts.length > 0) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Deposit Facts")
      .moveDown(0.5);

    evidencePack.depositFacts.forEach((fact, idx) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${idx + 1}. ${fact.factType}`)
        .font("Helvetica")
        .text(`   Occurred At: ${new Date(fact.occurredAt).toLocaleString()}`)
        .text(`   Account ID: ${fact.accountId}`)
        .text(`   Posting Type: ${fact.postingType || "N/A"}`)
        .moveDown(0.3);
    });
    doc.moveDown();
  }

  // Shadow AI Advisories
  if (evidencePack.shadowAIAdvisories.length > 0) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Shadow AI Advisories")
      .moveDown(0.5);

    doc
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#666666")
      .text(
        "Note: Shadow AI recommendations are logged for audit only. They do NOT execute or override system decisions.",
        { align: "left" }
      )
      .fillColor("#000000")
      .moveDown(0.5);

    evidencePack.shadowAIAdvisories.forEach((advisory, idx) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${idx + 1}. ${advisory.domain} - ${advisory.recommendation}`)
        .font("Helvetica")
        .text(`   Confidence: ${((advisory.confidence || 0) * 100).toFixed(1)}%`)
        .text(`   Reasoning: ${advisory.reasoning}`)
        .text(`   Model: ${advisory.modelVersion}`)
        .moveDown(0.3);
    });
    doc.moveDown();
  }

  // Audit Facts
  if (evidencePack.auditFacts.length > 0) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Audit Trail")
      .moveDown(0.5);

    evidencePack.auditFacts.forEach((fact, idx) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${idx + 1}. ${fact.actionType}`)
        .font("Helvetica")
        .text(`   Actor: ${fact.actor} (${fact.actorRole})`)
        .text(`   Target: ${fact.targetType} ${fact.targetId}`)
        .text(`   Result: ${fact.result}`)
        .text(`   Occurred At: ${new Date(fact.occurredAt).toLocaleString()}`)
        .moveDown(0.3);
    });
  }

  // Footer
  doc
    .moveDown(2)
    .fontSize(8)
    .font("Helvetica-Oblique")
    .fillColor("#666666")
    .text(
      "This evidence pack is generated from append-only facts. All facts are cryptographically linked and tamper-evident.",
      { align: "center" }
    )
    .text(
      "TuringCore v3 - Decision Governance Platform",
      { align: "center" }
    );

  doc.end();

  return doc as unknown as Readable;
}
