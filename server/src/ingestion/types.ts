export interface SourceColumnConfig {
  revenue?: string;
  cogs?: string;
  inventoryValue?: string;
  copqCost?: string;
  hrCost?: string;
  sourceKey?: string;
  sourceName?: string;
  revenueMtd?: string;
  revenueQtd?: string;
  revenueYtd?: string;
}

export interface SourceConfig {
  fileNamePattern?: string;
  range?: string;
  dateColumn?: string;
  dashboardSheetName?: string;
  totalCopqCell?: string;
  totalCopqLabelCell?: string;
  copqCell?: string;
  qaSavedAmountCell?: string;
  copqLabelCell?: string;
  qaSavedAmountLabelCell?: string;
  ncRecordsSheetName?: string;
  ncRecordsRange?: string;
  ncDateColumn?: string;
  ncDateColumnFallbacks?: string[];
  ncCopqColumn?: string;
  ncSourceKeyColumn?: string;
  columns: SourceColumnConfig;
}

export interface SourcePayload {
  providerFileId: string;
  fileName: string;
  mimeType?: string;
  modifiedTime?: Date;
  sizeBytes?: bigint;
  content: string;
}

export interface RawRow {
  [key: string]: unknown;
}

export interface NormalizedSourceRecord {
  sourceDate: Date;
  sourceKey?: string;
  normalized: Record<string, string>;
  raw: RawRow;
}

export interface RejectedSourceRecord {
  rowNumber: number;
  reason: string;
  raw: RawRow;
}

export interface AdapterResult {
  accepted: NormalizedSourceRecord[];
  rejected: RejectedSourceRecord[];
}

export interface AdapterContext {
  sourceDate?: Date;
  sourceFileName?: string;
}
