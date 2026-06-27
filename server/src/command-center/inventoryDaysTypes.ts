import type { MetricTrendPoint } from './types.js';

export interface InventoryDaysIntelligence {
  summary: {
    currentInventoryValue: number | null;
    ytdCogs: number | null;
    daysElapsed: number | null;
    inventoryDays: number | null;
    snapshotDate: string;
    financialYearStart: string;
    statusMessage: string | null;
    targetMinDays: number;
    targetMaxDays: number;
    health: 'good' | 'warning' | 'critical' | 'neutral';
    statusTooltip: string | null;
  };
  formula: {
    expression: string;
    inventory: number | null;
    daysElapsed: number | null;
    ytdCogs: number | null;
    inventoryDays: number | null;
  };
  trend: MetricTrendPoint[];
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
  dataSources: Array<{
    key: string;
    name: string;
    purpose: string;
    refreshDate: string;
    fileName: string | null;
  }>;
  methodology: string;
}
