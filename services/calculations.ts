
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

export const calculateReferences = (selectedYearMonth: string): { salarioRef: string; beneficioRef: string } => {
  if (!selectedYearMonth || !selectedYearMonth.includes('-')) {
    return { salarioRef: '', beneficioRef: '' };
  }
  const [yearStr, monthStr] = selectedYearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const salarioRef = `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;

  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const beneficioRef = `${String(nextMonth).padStart(2, '0')}/${String(nextYear).slice(-2)}`;

  return { salarioRef, beneficioRef };
};

export interface AdjustedPaystubValues {
  salario: number;
  alimentacao: number;
  transporte: number;
  isSalarioNegativo: boolean;
  alimentacaoDeducted: boolean;
  transporteDeducted: boolean;
}

export const adjustPaystubValues = (
  rawSalario: number,
  rawAlimentacao: number,
  rawTransporte: number
): AdjustedPaystubValues => {
  let salario = rawSalario;
  let alimentacao = rawAlimentacao;
  let transporte = rawTransporte;
  let alimentacaoDeducted = false;
  let transporteDeducted = false;

  // Rule: when alimentacao or transporte is negative, set as Ausente (0)
  // and deduct the difference from salario
  if (alimentacao < 0) {
    salario += alimentacao; // alimentacao is negative, so adding it deducts the value
    alimentacao = 0; // colocado como Ausente
    alimentacaoDeducted = true;
  }

  if (transporte < 0) {
    salario += transporte; // transporte is negative, so adding it deducts the value
    transporte = 0; // colocado como Ausente
    transporteDeducted = true;
  }

  return {
    salario,
    alimentacao,
    transporte,
    isSalarioNegativo: salario < 0,
    alimentacaoDeducted,
    transporteDeducted,
  };
};
