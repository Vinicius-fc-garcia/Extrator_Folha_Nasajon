import * as pdfjs from 'pdfjs-dist';
import type { TextItem, PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { PaystubRow, PaystubTotals, ExtractionResult } from '../types';

const MONETARY_REGEX = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const MONETARY_REGEX_GLOBAL = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

interface Word extends TextItem {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

const transformToWord = (item: TextItem): Word => {
  return {
    ...item,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height,
    text: item.str,
  };
};

const getWordsFromPage = async (page: PDFPageProxy): Promise<Word[]> => {
  const content = await page.getTextContent();
  return content.items.filter(item => 'str' in item && item.str.trim() !== '').map(item => transformToWord(item as TextItem));
};

const groupWordsIntoLines = (words: Word[], yTolerance = 5): Word[][] => {
  if (!words.length) return [];
  
  words.sort((a, b) => a.y === b.y ? a.x - b.x : b.y - a.y); // Sort top-to-bottom, left-to-right
  
  const lines: Word[][] = [];
  let currentLine: Word[] = [words[0]];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const prevWord = currentLine[currentLine.length - 1];
    
    if (Math.abs(word.y - prevWord.y) <= yTolerance) {
      currentLine.push(word);
    } else {
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [word];
    }
  }
  lines.push(currentLine.sort((a, b) => a.x - b.x));
  
  return lines;
};


async function parseResumoTable(pdf: PDFDocumentProxy, startPageIdx: number): Promise<PaystubRow[]> {
    const rows: PaystubRow[] = [];
    let lastRow: PaystubRow | null = null;
    const endPageIdx = Math.min(startPageIdx + 4, pdf.numPages);
    
    const seen = new Set<string>();

    for (let i = startPageIdx; i < endPageIdx; i++) {
        const page = await pdf.getPage(i + 1);
        let words = await getWordsFromPage(page);

        const headerWord = words.find(w => /resumo geral da folha/i.test(w.text) || /rubrica/i.test(w.text));
        const totalsAnchorWord = words.find(w => /(funcionarios|total\s+geral)/i.test(w.text));
        const startY = headerWord ? headerWord.y : Infinity;
        const endY = totalsAnchorWord ? totalsAnchorWord.y : -Infinity;

        words = words.filter(w => w.y < startY && w.y > endY);
        // Removed 'folha' from this filter as it was incorrectly removing valid descriptions.
        words = words.filter(w => !/(página|cnpj|empresa|analítica|nasajon|condomínio|ebac)/i.test(w.text));

        const lines = groupWordsIntoLines(words);

        const headerLine = lines.find(line => /Rendimentos/i.test(line.map(w => w.text).join(' ')) && /Descontos/i.test(line.map(w => w.text).join(' ')));
        if (!headerLine) continue;

        const rendimentosHeader = headerLine.find(w => /rendimentos/i.test(w.text));
        const descontosHeader = headerLine.find(w => /descontos/i.test(w.text));
        if (!rendimentosHeader || !descontosHeader) continue;

        // Calculate a precise midpoint between the two columns to classify values
        const columnMidPoint = (rendimentosHeader.x + rendimentosHeader.width + descontosHeader.x) / 2;
        
        for (const line of lines) {
            const lineText = line.map(w => w.text).join(' ').trim();
            if (!lineText || /Rubrica\s+Descrição\s+Rendimentos\s+Descontos/i.test(lineText)) {
                continue;
            }

            const match = lineText.match(/^([A-Z0-9]{2,10})\s*(.*)/);
            if (!match) {
                if (lastRow) {
                    // This is a continuation of a description from the previous line.
                    lastRow.Descrição += " " + lineText.replace(MONETARY_REGEX_GLOBAL, ' ').trim();
                    lastRow.Descrição = lastRow.Descrição.trim();
                }
                continue;
            }
            
            const code = match[1].trim();
            const monetaryWords = line.filter(w => MONETARY_REGEX.test(w.text));
            
            // Reconstruct description from words that are not the code and not a monetary value.
            const descriptionWords = line.filter(w => w.text !== code && !monetaryWords.some(mw => mw === w));
            const descClean = descriptionWords.map(w => w.text).join(' ').trim();

            let rendimento = '';
            let desconto = '';

            if (monetaryWords.length > 0) {
              // This logic assumes one value per row in this specific table format
              const valueWord = monetaryWords[0];
              if (valueWord.x < columnMidPoint) {
                  rendimento = valueWord.text;
              } else {
                  desconto = valueWord.text;
              }
            }

            lastRow = {
                Rubrica: code,
                Descrição: descClean,
                Rendimentos: rendimento,
                Descontos: desconto,
            };
            
            const key = Object.values(lastRow).join('|');
            if (!seen.has(key)) {
                rows.push(lastRow);
                seen.add(key);
            }
        }
    }

    return rows;
}

async function extractTotaisBlock(pdf: PDFDocumentProxy, startPageIdx: number): Promise<{ totals: PaystubTotals }> {
    const totals: PaystubTotals = { 'Salário Líquido Total': null };

    const endPageIdx = Math.min(startPageIdx + 5, pdf.numPages);

    for (let i = startPageIdx; i < endPageIdx; i++) {
        const page = await pdf.getPage(i + 1);
        const words = await getWordsFromPage(page);
        if (!words.length) continue;

        const totalsAnchorWord = words.find(w => /funcionarios/i.test(w.text));
        if (!totalsAnchorWord) continue;

        const searchableWords = words.filter(w => w.y <= totalsAnchorWord.y + 5);

        const salarioWord = searchableWords.find(w => /sal[aá]rio/i.test(w.text));
        const liquidoWord = searchableWords.find(w => /l[ií]quido/i.test(w.text));

        if (!salarioWord || !liquidoWord) continue;

        const labelX0 = salarioWord.x;
        const labelX1 = liquidoWord.x + liquidoWord.width;
        const labelBaselineY = Math.min(salarioWord.y, liquidoWord.y);

        const searchZone = {
            x0: labelX0 - 20,
            x1: labelX1 + 50,
            y0: labelBaselineY - 40,
            y1: labelBaselineY - 2,
        };
        
        const candidates = words.filter(w => 
            (w.x >= searchZone.x0 && w.x <= searchZone.x1) &&
            (w.y >= searchZone.y0 && w.y <= searchZone.y1) &&
            MONETARY_REGEX.test(w.text)
        );

        if (candidates.length > 0) {
            const labelCenterX = (labelX0 + labelX1) / 2;
            candidates.sort((a, b) => {
                const centerA = a.x + a.width / 2;
                const centerB = b.x + b.width / 2;
                return Math.abs(centerA - labelCenterX) - Math.abs(centerB - labelCenterX);
            });
            totals['Salário Líquido Total'] = candidates[0].text;
        }

        if (totals['Salário Líquido Total']) break;
    }

    return { totals };
}

export const processPdf = async (file: File): Promise<ExtractionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  
  let startPageIdx = -1;
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join('');
    if (pageText.includes('Resumo Geral da Folha de Pagamento por Rubrica')) {
      startPageIdx = i;
      break;
    }
  }

  if (startPageIdx === -1) {
    throw new Error("Não foi possível localizar a seção 'Resumo Geral da Folha de Pagamento por Rubrica'. Verifique o PDF.");
  }

  const rows = await parseResumoTable(pdf, startPageIdx);
  const { totals } = await extractTotaisBlock(pdf, startPageIdx);
  
  return { rows, totals };
};