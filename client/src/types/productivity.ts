export interface HrExpenseRecord {
  id: string;
  financialYear: number;
  financialYearLabel: string;
  month: number;
  calendarYear: number;
  monthLabel: string;
  hrExpense: number;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string | null;
}

export interface HrExpenseListResponse {
  records: HrExpenseRecord[];
}

export interface HrExpensePayload {
  month: number;
  year: number;
  hrExpense: number;
}

export interface ProductivityTrendPoint {
  monthLabel: string;
  month: number;
  calendarYear: number;
  revenue: number | null;
  hrExpense: number | null;
  productivityIndex: number | null;
}

export interface ProductivityIntelligence {
  summary: {
    productivityIndex: number | null;
    revenue: number | null;
    hrExpense: number | null;
    revenueYtd: number | null;
    revenueQtd: number | null;
    revenueMtd: number | null;
    hrExpenseYtd: number | null;
    hrExpenseQtd: number | null;
    hrExpenseMtd: number | null;
    productivityYtd: number | null;
    productivityQtd: number | null;
    productivityMtd: number | null;
    referenceDate: string | null;
  };
  trend: ProductivityTrendPoint[];
  hrExpenses: HrExpenseRecord[];
  dataSources: Array<{
    key: string;
    name: string;
    purpose: string;
    refreshType: string;
  }>;
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}
