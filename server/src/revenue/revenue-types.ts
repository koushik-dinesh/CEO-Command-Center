export interface RevenueSourceFile {
  id: string;
  name: string;
  mimeType: string | null;
  modifiedTime: string | null;
  size: string | null;
  fileDate: string;
  fileTimestamp: string;
}

export interface RevenueSalespersonRow {
  salespersonName: string;
  salespersonCode: string | null;
  revenueAmount: string;
  contributionPercent: string;
}

export interface RevenueSummary {
  totalRevenue: string;
  salespersonCount: number;
  averageRevenuePerSalesperson: string;
  highestRevenueContributor: RevenueSalespersonRow | null;
}

export interface RevenueDrilldownResponse {
  sourceFile: RevenueSourceFile;
  summary: RevenueSummary;
  rows: RevenueSalespersonRow[];
  topPerformers: RevenueSalespersonRow[];
  chartData: Array<{ salespersonName: string; revenueAmount: string }>;
}
