export interface PbtCalculatedRecord {
  id: string | null;
  month: number;
  year: number;
  monthLabel: string;
  revenue: number | null;
  directExpense: number | null;
  hrExpense: number | null;
  additionalIndirectExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PbtIntelligence {
  revenue: number | null;
  directExpense: number | null;
  hrExpense: number | null;
  additionalIndirectExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
  trend: Array<{
    monthLabel: string;
    month: number;
    year: number;
    revenue: number | null;
    directExpense: number | null;
    hrExpense: number | null;
    additionalIndirectExpense: number | null;
    indirectExpense: number | null;
    profitBeforeTax: number | null;
  }>;
  records: PbtCalculatedRecord[];
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}

export interface PbtHistoricalResponse {
  records: PbtCalculatedRecord[];
}

export interface PbtCalculatedResponse {
  records: PbtCalculatedRecord[];
  intelligence: PbtIntelligence;
}

export interface PbtRevenueResponse {
  month: number;
  year: number;
  revenue: number | null;
}

export interface PbtHrExpenseResponse {
  month: number;
  year: number;
  hrExpense: number | null;
}

export interface PbtInputPayload {
  month: number;
  year: number;
  directExpense: number;
  additionalIndirectExpense: number;
}
