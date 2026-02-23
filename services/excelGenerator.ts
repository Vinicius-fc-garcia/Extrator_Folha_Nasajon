
import * as xlsx from 'xlsx';
import type { PaystubRow, PaystubTotals, BatchExtractionResult } from '../types';
import { calculateTotals, normalizeText, parseCurrency } from './calculations';

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
  const { 
    alimentacaoValues, 
    transporteValues, 
    decimoTerceiroValues,
    alimentacaoSum,
    transporteSum,
    decimoTerceiroSum
  } = calculateTotals(rows);

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

    const isTarget13th = descValue.includes('adiantamento de 13o') || descValue.includes('13o salario');
    const isIgnored13thDiscount = descValue.includes('inss') || descValue.replace(/\./g, '').includes('irrf') || descValue.includes('pensao alimenticia');
    const isExcludedAdiantamento = descValue.includes('desconto de adiantamento de');

    if (isTarget13th && !isIgnored13thDiscount && !isExcludedAdiantamento) {
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

export const buildBatchExcel = (results: BatchExtractionResult[]): Blob => {
  const wb = xlsx.utils.book_new();
  const ws_data = [];

  // Header
  // Col A "Cond", Col B "Salário", Col C "Alimentação", Col D "Transporte"
  ws_data.push(["Cond", "Salário", "Alimentação", "Transporte"]);

  results.forEach(item => {
    if (!item.result) return; // Skip failed files or handle them differently? User said "Caso algum valor esteja zerado... não preencher". Failed files might just be skipped or logged.

    const { rows, totals } = item.result;
    const { alimentacaoSum, transporteSum } = calculateTotals(rows);
    
    // Parse Salário Líquido Total
    const salarioLiquidoStr = totals['Salário Líquido Total'];
    const salarioLiquido = salarioLiquidoStr ? parseCurrency(salarioLiquidoStr) : 0;

    // Prepare row data
    // If value is 0, leave blank (undefined or empty string)
    const rowData = [
      item.fileName,
      salarioLiquido !== 0 ? { v: salarioLiquido, t: 'n', z: '#,##0.00' } : '',
      alimentacaoSum !== 0 ? { v: alimentacaoSum, t: 'n', z: '#,##0.00' } : '',
      transporteSum !== 0 ? { v: transporteSum, t: 'n', z: '#,##0.00' } : ''
    ];

    ws_data.push(rowData);
  });

  const ws = xlsx.utils.aoa_to_sheet(ws_data);

  // Auto-fit columns (approximate)
  const colWidths = [
    { wch: 40 }, // Cond (Filename)
    { wch: 15 }, // Salário
    { wch: 15 }, // Alimentação
    { wch: 15 }, // Transporte
  ];
  ws['!cols'] = colWidths;

  // Header Style
  const headerRange = xlsx.utils.decode_range(ws['!ref'] || "A1:D1");
  for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
    const address = xlsx.utils.encode_col(C) + "1";
    if (!ws[address]) continue;
    if (!ws[address].s) ws[address].s = {};
    ws[address].s.font = { bold: true };
  }

  xlsx.utils.book_append_sheet(wb, ws, 'Batch_Export');
  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
};
