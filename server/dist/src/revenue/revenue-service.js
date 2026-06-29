import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { buildDrilldownFromSalespersonSnapshot } from './revenue-drilldown-builder.js';
export class RevenueService {
    async drilldown(snapshotKey) {
        const resolvedKey = snapshotKey ?? await this.resolveLatestSnapshotKey();
        if (!resolvedKey) {
            throw new Error('No revenue drilldown data available. Run sync to ingest snapshots from Google Drive.');
        }
        const fromSnapshot = await this.buildFromSnapshotKey(resolvedKey);
        if (!fromSnapshot) {
            throw new Error(`Revenue drilldown unavailable for snapshot ${resolvedKey}. Ensure the snapshot is complete.`);
        }
        return fromSnapshot;
    }
    async resolveLatestSnapshotKey() {
        const batches = await ReportSnapshotRepository.listBatches(1);
        return batches[0]?.snapshotKey ?? null;
    }
    async buildFromSnapshotKey(snapshotKey) {
        if (!await ReportSnapshotRepository.isCompleteSnapshotKey(snapshotKey))
            return null;
        const batch = await ReportSnapshotRepository.getBatch(snapshotKey);
        const salespersonRow = batch.find((row) => row.reportType === 'REVENUE_BY_SALESPERSON');
        if (!salespersonRow)
            return null;
        return buildDrilldownFromSalespersonSnapshot(salespersonRow);
    }
}
