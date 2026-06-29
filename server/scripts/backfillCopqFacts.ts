import 'dotenv/config';
import { parseJsonField } from '../src/db/json.js';
import { closePool } from '../src/db/mysql.js';
import { CopqAnalyticsService } from '../src/copq/CopqAnalyticsService.js';
import { resolveCopqNcValues } from '../src/copq/copqNcSheetLoad.js';
import { getLatestCopqStagingRecord } from '../src/copq/copqStagingQueries.js';
import { loadCopqDataSourceContext } from '../src/copq/copqNcParseConfig.js';
import { NcCopqFactRepository } from '../src/repositories/NcCopqFactRepository.js';

async function main() {
  const sourceContext = await loadCopqDataSourceContext();
  if (!sourceContext) throw new Error('COPQ_DASHBOARD_SHEET not configured');

  const staging = await getLatestCopqStagingRecord();
  if (!staging) {
    console.info('[backfill-copq-facts] No COPQ staging record found — nothing to backfill');
    await closePool();
    return;
  }

  const normalized = parseJsonField(staging.normalized) as Record<string, unknown>;
  const raw = parseJsonField(staging.raw);
  const nc = await resolveCopqNcValues(raw);

  const result = await CopqAnalyticsService.persistFromNcValues({
    dataSourceId: sourceContext.dataSourceId,
    ncValues: nc.values,
    ncSheetName: nc.sheetName,
    normalized,
    parseConfig: sourceContext.parseConfig,
    config: sourceContext.config,
  });

  const count = await NcCopqFactRepository.countForDataSource(sourceContext.dataSourceId);
  console.info('[backfill-copq-facts] Completed', {
    ncSource: nc.source,
    persisted: result,
    factRowCount: count,
  });

  await closePool();
}

main().catch((error) => {
  console.error('[backfill-copq-facts] Failed', error);
  process.exitCode = 1;
});
