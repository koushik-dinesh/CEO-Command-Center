import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { RevenueDrilldownCacheRepository } from '../repositories/RevenueDrilldownCacheRepository.js';
import { buildDrilldownFromSalespersonSnapshot } from './revenue-drilldown-builder.js';
import type { RevenueDrilldownResponse } from './revenue-types.js';

export class RevenueService {
  async drilldown(snapshotKey?: string): Promise<RevenueDrilldownResponse> {
    const resolvedKey = snapshotKey ?? await this.resolveLatestSnapshotKey();
    if (resolvedKey) {
      const fromSnapshot = await this.buildFromSnapshotKey(resolvedKey);
      if (fromSnapshot) return fromSnapshot;
    }

    const cached = await RevenueDrilldownCacheRepository.latest();
    if (cached) return cached.payloadJson;

    throw new Error('No revenue drilldown data available. Run sync to ingest snapshots from Google Drive.');
  }

  private async resolveLatestSnapshotKey(): Promise<string | null> {
    const batches = await ReportSnapshotRepository.listBatches(1);
    return batches[0]?.snapshotKey ?? null;
  }

  private async buildFromSnapshotKey(snapshotKey: string): Promise<RevenueDrilldownResponse | null> {
    if (!await ReportSnapshotRepository.isCompleteSnapshotKey(snapshotKey)) return null;
    const batch = await ReportSnapshotRepository.getBatch(snapshotKey);
    const salespersonRow = batch.find((row) => row.reportType === 'REVENUE_BY_SALESPERSON');
    if (!salespersonRow) return null;
    return buildDrilldownFromSalespersonSnapshot(salespersonRow);
  }
}
