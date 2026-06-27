import 'dotenv/config';
import { closePool } from '../src/db/mysql.js';
import { SnapshotMetricsService } from '../src/snapshots/SnapshotMetricsService.js';

async function main() {
  const count = await SnapshotMetricsService.backfillAll();
  console.info(`Backfilled ${count} complete snapshot metric row(s).`);
  await closePool();
}

main().catch((error) => {
  console.error('[backfill-snapshot-metrics] Failed', error);
  process.exitCode = 1;
});
