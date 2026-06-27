export type ReportType =
  | 'REVENUE_BY_SALESPERSON'
  | 'REVENUE_BY_CUSTOMER_GROUP'
  | 'REVENUE_BY_PRODUCT_GROUP'
  | 'REVENUE_VS_COGS'
  | 'INVENTORY_BY_WAREHOUSE'
  | 'DEAD_SLOW_MOVING_STOCK';

export interface ParsedFilename {
  reportType: ReportType;
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: string;
  fileName: string;
}

export interface DriveFilePayload {
  providerFileId: string;
  fileName: string;
  mimeType?: string;
  modifiedTime?: Date;
  sizeBytes?: bigint;
  content: string;
}

export interface ReportProcessor<T = unknown> {
  type: ReportType;
  pattern: RegExp;
  process: (content: string, meta: ParsedFilename) => T;
}

export interface RevenuePersonRow {
  name: string;
  code: string;
  mtd: number;
  qtd: number;
  ytd: number;
  contributionPct: number;
}

export interface RevenueCustomerRow {
  code: string;
  name: string;
  mtd: number;
  qtd: number;
  ytd: number;
  contributionPct: number;
}

export interface RevenueProductRow {
  code: string;
  name: string;
  mtdQty: number;
  mtdAmount: number;
  qtdQty: number;
  qtdAmount: number;
  ytdQty: number;
  ytdAmount: number;
  ytdGrossProfit: number;
  ytdGpPct: number;
  contributionPct: number;
}

export interface RevenueVsCogsRow {
  type: string;
  mtdRevenue: number;
  mtdCogs: number;
  qtdRevenue: number;
  qtdCogs: number;
  ytdRevenue: number;
  ytdCogs: number;
  grossProfitPct: number;
}

export interface WarehouseRow {
  code: string;
  name: string;
  skuCount: number;
  stockValue: number;
  contributionPct: number;
}

export interface DeadSlowStockRow {
  itemNo: string;
  description: string;
  itemGroup: string;
  qty: number;
  unitCost: number;
  stockValue: number;
  lastStockOutDate: string;
  daysIdle: number;
  status: string;
}

export interface RevenueSalespersonPayload {
  rows: RevenuePersonRow[];
  totalYtd: number;
  salespersonCount: number;
}

export interface RevenueCustomerGroupPayload {
  rows: RevenueCustomerRow[];
  totalYtd: number;
}

export interface RevenueProductGroupPayload {
  rows: RevenueProductRow[];
  totalYtd: number;
}

export interface RevenueVsCogsPayload {
  rows: RevenueVsCogsRow[];
  total: RevenueVsCogsRow | null;
}

export interface InventoryWarehousePayload {
  rows: WarehouseRow[];
  totalValue: number;
  warehouseCount: number;
}

export interface DeadSlowStockPayload {
  topProblemItems: DeadSlowStockRow[];
  deadStockValue: number;
  slowMovingValue: number;
  activeValue: number;
  deadCount: number;
  slowCount: number;
  activeCount: number;
  problemPct: number;
  agingBuckets: Array<{ label: string; value: number; count: number }>;
}

export type ReportPayload =
  | RevenueSalespersonPayload
  | RevenueCustomerGroupPayload
  | RevenueProductGroupPayload
  | RevenueVsCogsPayload
  | InventoryWarehousePayload
  | DeadSlowStockPayload;

export interface SnapshotBatch {
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: string;
  reportTypes: ReportType[];
  completeness: number;
}
