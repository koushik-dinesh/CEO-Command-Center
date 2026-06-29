import 'dotenv/config';
import { closePool, queryOne } from '../src/db/mysql.js';
import type { RowDataPacket } from 'mysql2';
import { KpiCurrentRepository } from '../src/repositories/KpiCurrentRepository.js';
import { SnapshotMetricsService } from '../src/snapshots/SnapshotMetricsService.js';

async function main() {
  const metricsCount = await SnapshotMetricsService.backfillAll();
  const kpiCount = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM kpi_current',
  );

  console.info('[backfill-analytics-storage] Completed', {
    snapshotMetricsRows: metricsCount,
    kpiCurrentRows: kpiCount?.total ?? 0,
  });

  const sampleKpi = await KpiCurrentRepository.findByCode('COPQ');
  if (sampleKpi) {
    console.info('[backfill-analytics-storage] Sample kpi_current COPQ value:', sampleKpi.valueDecimal);
  }

  await closePool();
}

main().catch((error) => {
  console.error('[backfill-analytics-storage] Failed', error);
  process.exitCode = 1;
});
