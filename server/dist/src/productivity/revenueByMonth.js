import { extractRevenuePeriods } from '../command-center/insights.js';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
import { queryOne } from '../db/mysql.js';
export async function getRevenueForMonth(month, year) {
    const row = await queryOne(`SELECT rs.payloadJson
     FROM report_snapshots rs
     INNER JOIN (
       SELECT snapshotKey
       FROM report_snapshots
       GROUP BY snapshotKey
       HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
     ) complete ON complete.snapshotKey = rs.snapshotKey
     WHERE rs.reportType = 'REVENUE_VS_COGS'
       AND YEAR(rs.snapshotDate) = ?
       AND MONTH(rs.snapshotDate) = ?
     ORDER BY rs.snapshotTimestamp DESC
     LIMIT 1`, [year, month]);
    if (!row)
        return null;
    let payload = null;
    if (typeof row.payloadJson === 'string') {
        try {
            payload = JSON.parse(row.payloadJson);
        }
        catch {
            return null;
        }
    }
    else if (row.payloadJson && typeof row.payloadJson === 'object') {
        payload = row.payloadJson;
    }
    if (!payload)
        return null;
    const periods = extractRevenuePeriods({
        revenueVsCogs: payload,
        salesperson: null,
        customerGroup: null,
        productGroup: null,
    });
    return periods.revenueMTD ?? payload.total?.mtdRevenue ?? null;
}
