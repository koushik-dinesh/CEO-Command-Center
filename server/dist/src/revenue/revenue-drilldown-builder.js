import { Decimal } from 'decimal.js';
import { RevenueDrilldownCacheRepository } from '../repositories/RevenueDrilldownCacheRepository.js';
function decimalString(value) {
    return new Decimal(value).toDecimalPlaces(4).toString();
}
function fileTimingFromSnapshot(row) {
    const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(row.snapshotKey);
    if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const fileDate = `${year}-${month}-${day}`;
        return { fileDate, fileTimestamp: `${fileDate}T${hour}:${minute}:${second}` };
    }
    const fileDate = row.snapshotDate.slice(0, 10);
    return { fileDate, fileTimestamp: row.snapshotTimestamp.toISOString().slice(0, 19) };
}
function buildSourceFile(row) {
    const { fileDate, fileTimestamp } = fileTimingFromSnapshot(row);
    return {
        id: row.providerFileId,
        name: row.fileName,
        mimeType: 'text/csv',
        modifiedTime: fileTimestamp,
        size: null,
        fileDate,
        fileTimestamp,
    };
}
export function buildDrilldownFromSalespersonSnapshot(row) {
    const payload = row.payloadJson;
    const sorted = [...payload.rows].sort((a, b) => b.ytd - a.ytd);
    const rows = sorted.map((person) => ({
        salespersonName: person.name,
        salespersonCode: person.code || null,
        revenueAmount: decimalString(person.ytd),
        contributionPercent: new Decimal(person.contributionPct).toDecimalPlaces(4).toString(),
    }));
    const totalRevenue = new Decimal(payload.totalYtd);
    return {
        sourceFile: buildSourceFile(row),
        summary: {
            totalRevenue: decimalString(payload.totalYtd),
            salespersonCount: payload.salespersonCount,
            averageRevenuePerSalesperson: payload.salespersonCount > 0
                ? decimalString(totalRevenue.div(payload.salespersonCount).toNumber())
                : '0',
            highestRevenueContributor: rows[0] ?? null,
        },
        rows,
        topPerformers: rows.slice(0, 10),
        chartData: rows.map((entry) => ({
            salespersonName: entry.salespersonName,
            revenueAmount: entry.revenueAmount,
        })),
    };
}
export async function refreshRevenueDrilldownCacheFromSnapshot(row) {
    const payloadJson = buildDrilldownFromSalespersonSnapshot(row);
    const { fileDate, fileTimestamp } = fileTimingFromSnapshot(row);
    await RevenueDrilldownCacheRepository.upsert({
        providerFileId: row.providerFileId,
        fileName: row.fileName,
        mimeType: 'text/csv',
        modifiedTime: row.snapshotTimestamp,
        sizeBytes: null,
        fileDate,
        fileTimestamp,
        checksum: row.checksum,
        payloadJson,
    });
}
