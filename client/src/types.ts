export type TrendDirection = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
export type KpiStatus = 'CURRENT' | 'STALE' | 'PARTIAL' | 'UNAVAILABLE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface KpiHistoryPoint {
  calculatedAt: string;
  value: string;
}

export interface KpiCardData {
  code: string;
  name: string;
  description: string;
  unit: string;
  displayFormat: string;
  currentValue: string | null;
  previousValue: string | null;
  changePercent: string | null;
  trendDirection: TrendDirection;
  status: KpiStatus;
  lastUpdatedAt: string | null;
  metadataJson: Record<string, unknown> | null;
  history: KpiHistoryPoint[];
  historyNote: string | null;
}

export interface ProcessingStatus {
  status: string;
  startedAt: string;
  finishedAt: string | null;
  dataSourceName: string;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  errorMessage: string | null;
}

export interface DashboardResponse {
  dashboardName: string;
  refreshedAt: string;
  dataLastUpdatedAt: string | null;
  refreshIntervalSeconds: number;
  kpis: KpiCardData[];
  processing: ProcessingStatus[];
}

export interface IngestionRunResult {
  sourceCode: string;
  status: string;
  processingLogId: string;
}

export interface IngestionRunResponse {
  message: string;
  newDataFound: boolean;
  results: IngestionRunResult[];
}

export interface CsvPreview {
  columns: string[];
  rows: Record<string, string>[];
}

export interface DriveExplorerFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  parents: string[];
  csvPreview: CsvPreview | null;
  readError: string | null;
}

export interface DriveExplorerFolder {
  sourceCode: string;
  sourceName: string;
  folderId: string;
  status: 'success' | 'failed' | 'not_configured';
  error: string | null;
  files: DriveExplorerFile[];
}

export interface DriveExplorerResponse {
  generatedAt: string;
  folders: DriveExplorerFolder[];
}

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
