import { jsPDF } from 'jspdf';

export interface ClassificationPdfData {
  salarioRef: string;
  beneficioRef: string;
  salario: number;
  alimentacao: number;
  transporte: number;
}

export interface PdfBlockOffsets {
  leftMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
}

export const DEFAULT_PDF_OFFSETS: PdfBlockOffsets = {
  leftMm: 125,
  topMm: 220,
  widthMm: 52,
  heightMm: 35,
};

const formatCurrency = (val: number): string => {
  if (val === undefined || val === null || val <= 0) return 'Ausente';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Draws the classification card on the current page of a jsPDF document.
 */
export const drawClassificationBlock = (
  doc: jsPDF,
  data: ClassificationPdfData,
  offsets: PdfBlockOffsets = DEFAULT_PDF_OFFSETS
) => {
  const { leftMm, topMm, widthMm, heightMm } = offsets;
  const rowHeight = heightMm / 7;
  const paddingX = 1.5; // mm from left/right of the card

  // Font size is strictly Arial 10pt as requested
  const fontSize = 10;

  // Outer border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(leftMm, topMm, widthMm, heightMm, 'S');

  doc.setTextColor(0, 0, 0);

  // Helper to get vertical baseline for row index (0..6), centered vertically in the row
  const getRowBaseline = (rowIndex: number) => {
    return topMm + (rowIndex * rowHeight) + (rowHeight / 2) + (fontSize * 0.35 / 2);
  };

  // Row 1 (Header): EBAC - Classificação
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.text('EBAC - Classificação', leftMm + paddingX, getRowBaseline(0));
  
  // Dividing line after Header (gray or thin black)
  doc.setDrawColor(180, 180, 180);
  doc.line(leftMm, topMm + rowHeight, leftMm + widthMm, topMm + rowHeight);

  // Row 2: Salários
  doc.setDrawColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text('Salários', leftMm + paddingX, getRowBaseline(1));

  // Row 3: Ref.: [salarioRef] and R$ [salario]
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const refTextSal = `Ref.:  ${data.salarioRef || 'Ausente'}`;
  doc.text(refTextSal, leftMm + paddingX, getRowBaseline(2));
  const refWidthSal = doc.getTextWidth(refTextSal);
  doc.text('R$', leftMm + paddingX + refWidthSal + 2.5, getRowBaseline(2));

  const salText = formatCurrency(data.salario);
  doc.text(salText, leftMm + widthMm - paddingX, getRowBaseline(2), { align: 'right' });

  // Dividing line after Salários
  doc.line(leftMm, topMm + 3 * rowHeight, leftMm + widthMm, topMm + 3 * rowHeight);

  // Row 4: Vale Alimentação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text('Vale Alimentação', leftMm + paddingX, getRowBaseline(3));

  // Row 5: Ref.: [beneficioRef] and R$ [alimentacao]
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const refTextAlim = `Ref.:  ${data.beneficioRef || 'Ausente'}`;
  doc.text(refTextAlim, leftMm + paddingX, getRowBaseline(4));
  const refWidthAlim = doc.getTextWidth(refTextAlim);
  doc.text('R$', leftMm + paddingX + refWidthAlim + 2.5, getRowBaseline(4));

  const alimText = formatCurrency(data.alimentacao);
  doc.text(alimText, leftMm + widthMm - paddingX, getRowBaseline(4), { align: 'right' });

  // Dividing line after Vale Alimentação
  doc.line(leftMm, topMm + 5 * rowHeight, leftMm + widthMm, topMm + 5 * rowHeight);

  // Row 6: Vale Transporte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text('Vale Transporte', leftMm + paddingX, getRowBaseline(5));

  // Row 7: Ref.: [beneficioRef] and R$ [transporte]
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const refTextTrans = `Ref.:  ${data.beneficioRef || 'Ausente'}`;
  doc.text(refTextTrans, leftMm + paddingX, getRowBaseline(6));
  const refWidthTrans = doc.getTextWidth(refTextTrans);
  doc.text('R$', leftMm + paddingX + refWidthTrans + 2.5, getRowBaseline(6));

  const transText = formatCurrency(data.transporte);
  doc.text(transText, leftMm + widthMm - paddingX, getRowBaseline(6), { align: 'right' });
};

/**
 * Exports a single A4 PDF sheet with the classification block.
 */
export const exportClassificationPdf = (
  fileName: string,
  data: ClassificationPdfData,
  offsets: PdfBlockOffsets
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  drawClassificationBlock(doc, data, offsets);
  doc.save(`Classificacao_${fileName || 'Folha'}.pdf`);
};

/**
 * Exports a multi-page A4 PDF sheet for batch processing.
 */
export const exportBatchClassificationPdf = (
  items: Array<{ fileName: string; data: ClassificationPdfData }>,
  offsets: PdfBlockOffsets
) => {
  if (items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  items.forEach((item, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }
    drawClassificationBlock(doc, item.data, offsets);
  });

  doc.save(`Classificacao_Lote_${new Date().toISOString().slice(0, 10)}.pdf`);
};
