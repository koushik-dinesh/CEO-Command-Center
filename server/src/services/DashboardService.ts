import { DashboardConfigurationRepository } from '../repositories/DashboardConfigurationRepository.js';
import { KpiRepository } from '../repositories/KpiRepository.js';
import { StagingRecordRepository } from '../repositories/StagingRecordRepository.js';
import { ProcessingLogService } from './ProcessingLogService.js';

function decimalToString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

const revenueMethodologyVersion = 'sales-revenue-customer-group-latest-file-ytd-v1';

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function kpiLastUpdatedAt(latest: Awaited<ReturnType<typeof KpiRepository.latestValue>>): string | null {
  if (!latest) return null;
  const sourceUpdatedAt = (
    isoOrNull(metadataString(latest.metadataJson, 'sourceLastUpdatedAt')) ??
    isoOrNull(metadataString(latest.metadataJson, 'sourceDate')) ??
    isoOrNull(metadataString(latest.metadataJson, 'sourceWorkbookModifiedTime'))
  );
  if (sourceUpdatedAt) return sourceUpdatedAt;
  if (latest.status === 'UNAVAILABLE' || latest.valueDecimal === null) return null;
  return (
    isoOrNull(latest.calculatedAt)
  );
}

async function prepareHistory(definitionCode: string, history: Awaited<ReturnType<typeof KpiRepository.history>>) {
  if (definitionCode !== 'REVENUE') {
    return {
      history: history.reverse().map((point) => ({ calculatedAt: point.calculatedAt.toISOString(), value: point.valueDecimal?.toString() ?? '0' })),
      historyNote: null,
    };
  }

  const analyticsHistory = await StagingRecordRepository.revenueSnapshots(8);
  if (analyticsHistory.length < 3) {
    return {
      history: [],
      historyNote: 'Not enough history available',
    };
  }

  return {
    history: analyticsHistory,
    historyNote: null,
  };
}

export class DashboardService {
  static async getDashboard() {
    const config = await DashboardConfigurationRepository.defaultConfig();
    const definitions = await KpiRepository.activeDefinitions();

    const kpis = await Promise.all(definitions.map(async (definition) => {
      const latest = await KpiRepository.latestValue(definition.id);
      const history = await KpiRepository.history(definition.id, definition.code === 'REVENUE' ? 64 : 8);
      const lastUpdatedAt = kpiLastUpdatedAt(latest);
      const preparedHistory = await prepareHistory(definition.code, history);

      return {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        unit: definition.unit,
        displayFormat: definition.displayFormat,
        currentValue: decimalToString(latest?.valueDecimal),
        previousValue: decimalToString(latest?.previousValueDecimal),
        changePercent: decimalToString(latest?.changePercent),
        trendDirection: latest?.trendDirection ?? 'UNKNOWN',
        status: latest?.status ?? 'UNAVAILABLE',
        lastUpdatedAt,
        metadataJson: latest?.metadataJson ?? null,
        history: preparedHistory.history,
        historyNote: preparedHistory.historyNote,
      };
    }));

    const dataLastUpdatedAt = kpis
      .map((kpi) => kpi.lastUpdatedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

    return {
      dashboardName: config?.name ?? 'Dashboard',
      refreshedAt: new Date().toISOString(),
      dataLastUpdatedAt,
      refreshIntervalSeconds: config?.refreshIntervalSeconds ?? 900,
      kpis,
      processing: await ProcessingLogService.latest(8),
    };
  }
}
