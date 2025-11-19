import * as xlsx from 'xlsx';
import type { PaystubRow, PaystubTotals } from '../types';

// Helper to parse currency string "1.234,56" into a number 1234.56
const parseCurrency = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

// Helper to normalize text (lowercase, remove accents, handle ordinals)
const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/º/g, 'o')
    .replace(/ª/g, 'a')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const buildExcel = (rows: PaystubRow[], totals: PaystubTotals): Blob => {
  const wb = xlsx.utils.book_new();
  const ws_data = [];

  // Re-add the total salary row at the top as requested
  ws_data.push(["Salário Líquido Total:", totals['Salário Líquido Total'] || ""]);
  ws_data.push([]); // Blank line

  if (rows.length > 0) {
    ws_data.push(Object.keys(rows[0]));
    rows.forEach(row => {
      ws_data.push(Object.values(row));
    });
  } else {
    ws_data.push(["Rubrica", "Descrição", "Rendimentos", "Descontos"]);
  }
  
  // --- Summary Table Calculation ---
  const alimentacaoValues: number[] = [];
  const transporteValues: number[] = [];
  const decimoTerceiroValues: number[] = [];

  rows.forEach(row => {
    const descNorm = normalizeText(row.Descrição);
    const rendimento = parseCurrency(row.Rendimentos);
    const desconto = parseCurrency(row.Descontos);

    if (descNorm.includes('alimentacao') || descNorm.includes('cesta')) {
      if (rendimento > 0) alimentacaoValues.push(rendimento);
      if (desconto > 0) alimentacaoValues.push(-desconto);
    }
    
    // Rule: ignore 'transporte' if description contains '%'
    if (descNorm.includes('transporte') && !row.Descrição.includes('%')) {
       if (rendimento > 0) transporteValues.push(rendimento);
       if (desconto > 0) transporteValues.push(-desconto);
    }

    // Rule: for 13th salary, only sum the main payment and subtract the advance repayment discount.
    // Ignore taxes (INSS, IRRF) and other deductions (e.g., pensao alimenticia).
    const isIgnored13thDiscount = descNorm.includes('inss') || descNorm.replace(/\./g, '').includes('irrf') || descNorm.includes('pensao alimenticia');
    if (descNorm.includes('13o') && !isIgnored13thDiscount) {
      if (rendimento > 0) decimoTerceiroValues.push(rendimento);
      if (desconto > 0) decimoTerceiroValues.push(-desconto);
    }
  });

  const alimentacaoSum = alimentacaoValues.reduce((sum, val) => sum + val, 0);
  const transporteSum = transporteValues.reduce((sum, val) => sum + val, 0);
  const decimoTerceiroSum = decimoTerceiroValues.reduce((sum, val) => sum + val, 0);

  // Add summary table to worksheet data
  ws_data.push([]); // Blank line
  ws_data.push([]); // Blank line

  const summaryStartRow = ws_data.length;
  ws_data.push(['', 'Alimentação/Cesta:', 'Transporte:', '13º Salário:']);
  
  const maxLen = Math.max(alimentacaoValues.length, transporteValues.length, decimoTerceiroValues.length);
  for (let i = 0; i < maxLen; i++) {
    ws_data.push([
      '', 
      alimentacaoValues[i] !== undefined ? { v: alimentacaoValues[i], t: 'n', z: '#,##0.00' } : '', 
      transporteValues[i] !== undefined ? { v: transporteValues[i], t: 'n', z: '#,##0.00' } : '',
      decimoTerceiroValues[i] !== undefined ? { v: decimoTerceiroValues[i], t: 'n', z: '#,##0.00' } : '',
    ]);
  }
  ws_data.push(['', { v: alimentacaoSum, t: 'n', z: '#,##0.00' }, { v: transporteSum, t: 'n', z: '#,##0.00' }, { v: decimoTerceiroSum, t: 'n', z: '#,##0.00' }]);
  const summaryEndRow = ws_data.length - 1;

  // --- Create Worksheet ---
  const ws = xlsx.utils.aoa_to_sheet(ws_data);

  // Auto-fit columns
  const colWidths = [
    { wch: 15 }, // Rubrica
    { wch: 50 }, // Descrição
    { wch: 15 }, // Rendimentos
    { wch: 15 }, // Descontos
  ];
  ws['!cols'] = colWidths;
  
  // --- Cell Styling ---
  const boldStyle = { font: { bold: true } };
  const alimentacaoFill = { fill: { fgColor: { rgb: "FFDDE1" } } }; // Light Red
  const transporteFill = { fill: { fgColor: { rgb: "E2F0D5" } } }; // Light Green
  const decimoTerceiroFill = { fill: { fgColor: { rgb: "DDEBF7" } } }; // Light Blue

  // Style the Salário Líquido Total row
  const sltLabelRef = xlsx.utils.encode_cell({ c: 0, r: 0 });
  const sltValueRef = xlsx.utils.encode_cell({ c: 1, r: 0 });
  if (ws[sltLabelRef]) {
      ws[sltLabelRef].s = boldStyle;
  }
  if (ws[sltValueRef]) {
      ws[sltValueRef].s = boldStyle;
  }

  // Apply summary table styles
  for (let R = summaryStartRow; R <= summaryEndRow; ++R) {
    for (let C = 1; C <= 3; ++C) { // Only columns B, C, and D
      const cell_ref = xlsx.utils.encode_cell({ c: C, r: R });
      if(!ws[cell_ref]) continue;

      if(!ws[cell_ref].s) ws[cell_ref].s = {};

      if(R === summaryStartRow || R === summaryEndRow) {
          ws[cell_ref].s.font = { ...ws[cell_ref].s.font, bold: true };
      }
      if (C === 1) {
          ws[cell_ref].s.fill = alimentacaoFill.fill;
      } else if (C === 2) {
          ws[cell_ref].s.fill = transporteFill.fill;
      } else if (C === 3) {
        ws[cell_ref].s.fill = decimoTerceiroFill.fill;
      }
    }
  }
  const summaryHeaderB = xlsx.utils.encode_cell({c: 1, r: summaryStartRow});
  const summaryHeaderC = xlsx.utils.encode_cell({c: 2, r: summaryStartRow});
  const summaryHeaderD = xlsx.utils.encode_cell({c: 3, r: summaryStartRow});
  if(ws[summaryHeaderB]) {
      if(!ws[summaryHeaderB].s) ws[summaryHeaderB].s = {};
       ws[summaryHeaderB].s.font = { ...ws[summaryHeaderB].s.font, bold: true };
  }
   if(ws[summaryHeaderC]) {
      if(!ws[summaryHeaderC].s) ws[summaryHeaderC].s = {};
       ws[summaryHeaderC].s.font = { ...ws[summaryHeaderC].s.font, bold: true };
  }
  if(ws[summaryHeaderD]) {
    if(!ws[summaryHeaderD].s) ws[summaryHeaderD].s = {};
     ws[summaryHeaderD].s.font = { ...ws[summaryHeaderD].s.font, bold: true };
  }

  // Apply font color styling to main table
  const dataStartRow = 3; 
  const dataEndRow = summaryStartRow - 3;
  for (let R = dataStartRow; R <= dataEndRow; R++) {
    const descCellRef = xlsx.utils.encode_cell({ c: 1, r: R });
    const descCell = ws[descCellRef];
    if (!descCell || !descCell.v) continue;

    const originalDesc = descCell.v.toString();
    const descValue = normalizeText(originalDesc);
    let rowFontColor = null;

    const isIgnored13thDiscount = descValue.includes('inss') || descValue.replace(/\./g, '').includes('irrf') || descValue.includes('pensao alimenticia');
    if (descValue.includes("13o") && !isIgnored13thDiscount) {
        rowFontColor = { rgb: "0070C0" }; // Blue
    } else if (descValue.includes("cesta")) {
        rowFontColor = { rgb: "7030A0" }; // Purple
    } else if (descValue.includes("alimentacao")) {
        rowFontColor = { rgb: "C00000" }; // Red
    } else if (descValue.includes("transporte") && !originalDesc.includes('%')) {
        rowFontColor = { rgb: "00B050" }; // Green
    }

    if (rowFontColor) {
        for (let C = 0; C < 4; C++) {
            const cell_ref = xlsx.utils.encode_cell({ c: C, r: R });
            
            // FIX: If a cell doesn't exist (because it's empty), create it to apply style.
            if (!ws[cell_ref]) {
              ws[cell_ref] = { t: 's', v: '' };
            }
            
            if (!ws[cell_ref].s) ws[cell_ref].s = {};
            ws[cell_ref].s.font = { ...ws[cell_ref].s.font, color: rowFontColor };
        }
    }
  }


  xlsx.utils.book_append_sheet(wb, ws, 'Resumo_Rubricas');

  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
};