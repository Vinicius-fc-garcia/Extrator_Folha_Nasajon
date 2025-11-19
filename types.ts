
export interface PaystubRow {
  Rubrica: string;
  Descrição: string;
  Rendimentos: string;
  Descontos: string;
}

export interface PaystubTotals {
  'Salário Líquido Total': string | null;
}

export interface ExtractionResult {
  rows: PaystubRow[];
  totals: PaystubTotals;
}
