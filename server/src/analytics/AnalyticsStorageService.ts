import type { KpiValueRow } from '../db/types.js';
import { KpiCurrentRepository } from '../repositories/KpiCurrentRepository.js';
import { KpiHistoryRepository } from '../repositories/KpiHistoryRepository.js';
import { logger } from '../utils/logger.js';

export class AnalyticsStorageService {
  static async persistKpi(kpiCode: string, value: KpiValueRow): Promise<void> {
    try {
      await KpiCurrentRepository.upsertFromValue(kpiCode, value);
      await KpiHistoryRepository.append(kpiCode, value);
    } catch (error) {
      logger.warn('analytics storage: failed to persist KPI value', {
        operation: 'analytics.persistKpi',
        kpiCode,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
