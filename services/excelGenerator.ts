
import * as xlsx from 'xlsx';
import type { PaystubRow, PaystubTotals, BatchExtractionResult } from '../types';
import { calculateTotals, normalizeText, parseCurrency, adjustPaystubValues } from './calculations';

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
  // Col A "Cond", Col B "Salário", Col C "Alimentação", Col D "Transporte", Col E "13º Salário"
  ws_data.push(["Cond", "Salário", "Alimentação", "Transporte", "13º Salário"]);

  results.forEach(item => {
    if (!item.result) return;

    const { rows, totals } = item.result;
    const { alimentacaoSum, transporteSum, decimoTerceiroSum } = calculateTotals(rows);
    
    // Parse Salário Líquido Total
    const salarioLiquidoStr = totals['Salário Líquido Total'];
    const rawSalario = salarioLiquidoStr ? parseCurrency(salarioLiquidoStr) : 0;

    // Apply rule: negative alimentacao or transporte -> Ausente (0) and deduct difference from salario
    const { salario, alimentacao, transporte } = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);

    // Prepare row data: if value <= 0, leave blank as requested
    const rowData = [
      item.fileName,
      salario !== 0 ? { v: salario, t: 'n', z: '#,##0.00' } : '',
      alimentacao > 0 ? { v: alimentacao, t: 'n', z: '#,##0.00' } : '',
      transporte > 0 ? { v: transporte, t: 'n', z: '#,##0.00' } : '',
      decimoTerceiroSum !== 0 ? { v: decimoTerceiroSum, t: 'n', z: '#,##0.00' } : ''
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
    { wch: 15 }, // 13º Salário
  ];
  ws['!cols'] = colWidths;

  // Header Style
  const headerRange = xlsx.utils.decode_range(ws['!ref'] || "A1:E1");
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

const createA4ClassificationSheet = (
  _condName: string,
  salario: number,
  alimentacao: number,
  transporte: number,
  salarioRef: string,
  beneficioRef: string
) => {
  const ws_data: any[][] = [];

  // Rows 1 to 42 (indexes 0 to 41): empty rows
  for (let r = 0; r < 42; r++) {
    ws_data.push([]);
  }

  // Prepend 11 empty columns (Cols A to K, 0-indexed 0..10) to position block at Col L
  const emptyAtoK = new Array(11).fill('');

  // Row 43 (index 42): Header - Fixed to "EBAC - Classificação" for all documents
  ws_data.push([...emptyAtoK, 'EBAC - Classificação', '', '', '', '', '']);

  // Row 44 (index 43): Salários
  ws_data.push([...emptyAtoK, 'Salários', '', '', '', '', '']);

  // Row 45 (index 44): Salários Details (Col L: Ref, Col N: R$, Col Q: Value/Ausente)
  ws_data.push([
    ...emptyAtoK,
    `Ref.:  ${salarioRef}`,
    '',
    'R$',
    '',
    '',
    salario > 0 ? { v: salario, t: 'n', z: '#,##0.00' } : 'Ausente'
  ]);

  // Row 46 (index 45): Vale Alimentação
  ws_data.push([...emptyAtoK, 'Vale Alimentação', '', '', '', '', '']);

  // Row 47 (index 46): Vale Alimentação Details
  ws_data.push([
    ...emptyAtoK,
    `Ref.:  ${beneficioRef}`,
    '',
    'R$',
    '',
    '',
    alimentacao > 0 ? { v: alimentacao, t: 'n', z: '#,##0.00' } : 'Ausente'
  ]);

  // Row 48 (index 47): Vale Transporte
  ws_data.push([...emptyAtoK, 'Vale Transporte', '', '', '', '', '']);

  // Row 49 (index 48): Vale Transporte Details
  ws_data.push([
    ...emptyAtoK,
    `Ref.:  ${beneficioRef}`,
    '',
    'R$',
    '',
    '',
    transporte > 0 ? { v: transporte, t: 'n', z: '#,##0.00' } : 'Ausente'
  ]);

  // Rows 50, 51, 52 (indexes 49, 50, 51): complete the $L$43:$Q$52 block
  for (let r = 49; r < 52; r++) {
    ws_data.push([...emptyAtoK, '', '', '', '', '', '']);
  }

  // Rows 53 to 55: empty rows representing the bottom margin of page 1
  for (let r = 52; r < 55; r++) {
    ws_data.push([]);
  }

  const ws = xlsx.utils.aoa_to_sheet(ws_data);

  // Column widths (A to K spacing for 125mm left, L to Q fitted to block width 52mm / 5.2cm)
  const cols = [];
  for (let c = 0; c < 11; c++) {
    cols.push({ wch: 4.8 }); // A to K
  }
  // Cols L to Q (total width approx 52mm / 5.2cm)
  cols.push({ wch: 7.5 }); // L (Ref.:)
  cols.push({ wch: 4 });   // M (MM/AA)
  cols.push({ wch: 2.5 }); // N (R$)
  cols.push({ wch: 1.5 }); // O
  cols.push({ wch: 1.5 }); // P
  cols.push({ wch: 8.5 }); // Q (Ausente or valor)
  ws['!cols'] = cols;

  // Merges matching exact $L$43:$Q$52 layout:
  ws['!merges'] = [
    { s: { r: 42, c: 11 }, e: { r: 42, c: 16 } }, // Row 43: L to Q ("EBAC - Classificação")
    { s: { r: 43, c: 11 }, e: { r: 43, c: 16 } }, // Row 44: L to Q ("Salários")
    { s: { r: 44, c: 11 }, e: { r: 44, c: 12 } }, // Row 45: L to M ("Ref.: MM/AA")
    { s: { r: 44, c: 14 }, e: { r: 44, c: 15 } }, // Row 45: O to P
    { s: { r: 45, c: 11 }, e: { r: 45, c: 16 } }, // Row 46: L to Q ("Vale Alimentação")
    { s: { r: 46, c: 11 }, e: { r: 46, c: 12 } }, // Row 47: L to M ("Ref.: MM/AA")
    { s: { r: 46, c: 14 }, e: { r: 46, c: 15 } }, // Row 47: O to P
    { s: { r: 47, c: 11 }, e: { r: 47, c: 16 } }, // Row 48: L to Q ("Vale Transporte")
    { s: { r: 48, c: 11 }, e: { r: 48, c: 12 } }, // Row 49: L to M ("Ref.: MM/AA")
    { s: { r: 48, c: 14 }, e: { r: 48, c: 15 } }, // Row 49: O to P
  ];

  // Set Row Heights: rows 1 to 42 for ~220mm top, and rows 43 to 52 for 35mm block height (~9.9 pt / 13.2 px per row)
  const rowsHeight = [];
  for (let r = 0; r < 42; r++) {
    rowsHeight.push({ hpt: 14.85, hpx: 19.8 });
  }
  for (let r = 42; r < 52; r++) {
    rowsHeight.push({ hpt: 9.9, hpx: 13.2 });
  }
  for (let r = 52; r < 55; r++) {
    rowsHeight.push({ hpt: 14.25, hpx: 19 });
  }
  ws['!rows'] = rowsHeight;

  // Page Setup for A4 Portrait
  (ws as any)['!pageSetup'] = {
    paperSize: 9, // A4
    orientation: 'portrait',
  };

  return ws;
};

export const buildClassificationExcel = (
  condName: string,
  salario: number,
  alimentacao: number,
  transporte: number,
  salarioRef: string,
  beneficioRef: string
): Blob => {
  const wb = xlsx.utils.book_new();
  const ws = createA4ClassificationSheet(condName, salario, alimentacao, transporte, salarioRef, beneficioRef);
  xlsx.utils.book_append_sheet(wb, ws, 'Classificação');
  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
};

export const buildBatchClassificationExcel = (
  results: BatchExtractionResult[],
  salarioRef: string,
  beneficioRef: string
): Blob => {
  const wb = xlsx.utils.book_new();
  const usedNames = new Set<string>();

  results.forEach((item, index) => {
    if (!item.result) return;
    const { rows, totals } = item.result;
    const { alimentacaoSum, transporteSum } = calculateTotals(rows);
    const salarioLiquidoStr = totals['Salário Líquido Total'];
    const rawSalario = salarioLiquidoStr ? parseCurrency(salarioLiquidoStr) : 0;
    const { salario, alimentacao, transporte } = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);

    const baseName = item.fileName.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 28) || `Cond_${index + 1}`;
    let sheetName = baseName;
    let counter = 1;
    while (usedNames.has(sheetName.toLowerCase())) {
      sheetName = `${baseName.slice(0, 25)}_${counter++}`;
    }
    usedNames.add(sheetName.toLowerCase());

    const ws = createA4ClassificationSheet(item.fileName, salario, alimentacao, transporte, salarioRef, beneficioRef);
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  });

  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
};
