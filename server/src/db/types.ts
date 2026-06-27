export const SourceType = {
  CSV: 'CSV',
  GOOGLE_SHEET: 'GOOGLE_SHEET',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const SourceProvider = {
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  GOOGLE_SHEETS: 'GOOGLE_SHEETS',
  MANUAL: 'MANUAL',
} as const;
export type SourceProvider = (typeof SourceProvider)[keyof typeof SourceProvider];

export const ProcessingStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  PARTIAL: 'PARTIAL',
} as const;
export type ProcessingStatus = (typeof ProcessingStatus)[keyof typeof ProcessingStatus];

export const KpiStatus = {
  CURRENT: 'CURRENT',
  STALE: 'STALE',
  PARTIAL: 'PARTIAL',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type KpiStatus = (typeof KpiStatus)[keyof typeof KpiStatus];

export const TrendDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
  FLAT: 'FLAT',
  UNKNOWN: 'UNKNOWN',
} as const;
export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSourceRow {
  id: string;
  code: string;
  name: string;
  sourceType: SourceType;
  provider: SourceProvider;
  locationRef: string;
  configJson: unknown;
  isActive: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadedFileRow {
  id: string;
  dataSourceId: string;
  providerFileId: string;
  fileName: string;
  mimeType: string | null;
  checksum: string;
  modifiedTime: Date | null;
  sizeBytes: bigint | null;
  status: ProcessingStatus;
  createdAt: Date;
}

export interface ProcessingLogRow {
  id: string;
  dataSourceId: string;
  uploadedFileId: string | null;
  runType: string;
  status: ProcessingStatus;
  startedAt: Date;
  finishedAt: Date | null;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  errorMessage: string | null;
  metadataJson: unknown | null;
}

export interface KpiDefinitionRow {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  displayFormat: string;
  calculationType: string;
  sortOrder: number;
  isActive: boolean;
  configJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KpiValueRow {
  id: string;
  kpiDefinitionId: string;
  periodStart: Date;
  periodEnd: Date;
  valueDecimal: string | null;
  previousValueDecimal: string | null;
  changePercent: string | null;
  trendDirection: TrendDirection;
  status: KpiStatus;
  sourceRunId: string | null;
  metadataJson: unknown | null;
  calculatedAt: Date;
  createdAt: Date;
}

export interface DashboardConfigurationRow {
  id: string;
  name: string;
  isDefault: boolean;
  layoutJson: unknown;
  refreshIntervalSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StagingRecordWithSourceRow {
  id: string;
  dataSourceId: string;
  sourceDate: Date;
  sourceKey: string | null;
  normalized: unknown;
  raw: unknown;
  createdAt: Date;
  dataSourceCode: string;
}
