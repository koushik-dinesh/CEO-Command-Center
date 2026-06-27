import { extractRevenuePeriods } from '../command-center/insights.js';
import type { RevenueVsCogsPayload } from '../reports/types.js';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
import { queryOne } from '../db/mysql.js';
import type { RowDataPacket } from 'mysql2';

export async function getRevenueForMonth(month: number, year: number): Promise<number | null> {
  const row = await queryOne<RowDataPacket & { payloadJson: unknown }>(
    `SELECT rs.payloadJson
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
     LIMIT 1`,
    [year, month],
  );

  if (!row) return null;

  let payload: RevenueVsCogsPayload | null = null;
  if (typeof row.payloadJson === 'string') {
    try {
      payload = JSON.parse(row.payloadJson) as RevenueVsCogsPayload;
    } catch {
      return null;
    }
  } else if (row.payloadJson && typeof row.payloadJson === 'object') {
    payload = row.payloadJson as RevenueVsCogsPayload;
  }

  if (!payload) return null;

  const periods = extractRevenuePeriods({
    revenueVsCogs: payload,
    salesperson: null,
    customerGroup: null,
    productGroup: null,
  });

  return periods.revenueMTD ?? payload.total?.mtdRevenue ?? null;
}
