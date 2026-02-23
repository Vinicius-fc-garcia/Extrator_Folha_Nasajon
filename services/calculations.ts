
import type { PaystubRow } from '../types';

export const parseCurrency = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

export const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/º/g, 'o')
    .replace(/ª/g, 'a')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export interface CalculatedValues {
  alimentacaoSum: number;
  transporteSum: number;
  decimoTerceiroSum: number;
  alimentacaoValues: number[];
  transporteValues: number[];
  decimoTerceiroValues: number[];
}

export const calculateTotals = (rows: PaystubRow[]): CalculatedValues => {
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

    // Rule: for 13th salary, strictly look for "Adiantamento de 13º" and "13º Salário".
    // Exceptions:
    // 1. Ignore taxes (INSS, IRRF) that might mention 13th salary.
    // 2. Ignore "Desconto de Adiantamento de..."
    const isTarget13th = descNorm.includes('adiantamento de 13o') || descNorm.includes('13o salario');
    const isIgnored13thDiscount = descNorm.includes('inss') || descNorm.replace(/\./g, '').includes('irrf') || descNorm.includes('pensao alimenticia');
    const isExcludedAdiantamento = descNorm.includes('desconto de adiantamento de');
    
    if (isTarget13th && !isIgnored13thDiscount && !isExcludedAdiantamento) {
      if (rendimento > 0) decimoTerceiroValues.push(rendimento);
      if (desconto > 0) decimoTerceiroValues.push(-desconto);
    }
  });

  const alimentacaoSum = alimentacaoValues.reduce((sum, val) => sum + val, 0);
  const transporteSum = transporteValues.reduce((sum, val) => sum + val, 0);
  const decimoTerceiroSum = decimoTerceiroValues.reduce((sum, val) => sum + val, 0);

  return { 
    alimentacaoSum, 
    transporteSum, 
    decimoTerceiroSum,
    alimentacaoValues,
    transporteValues,
    decimoTerceiroValues
  };
};
