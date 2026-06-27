import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../.env') });
import { createHash } from 'node:crypto';
import { transaction } from '../src/db/mysql.js';
import { ProcessingStatus } from '../src/db/types.js';
import { calculateCopqPeriodTotals } from '../src/copq/copqPeriods.js';
import { parseNcCopqRecords } from '../src/copq/ncRecords.js';
import { KpiCalculationService } from '../src/kpis/KpiCalculationService.js';
import { DataSourceRepository } from '../src/repositories/DataSourceRepository.js';
import { StagingRecordRepository } from '../src/repositories/StagingRecordRepository.js';
import { UploadedFileRepository } from '../src/repositories/UploadedFileRepository.js';
import { buildCopqKpi } from '../src/command-center/copqKpi.js';
import { closePool } from '../src/db/mysql.js';
/** Audit baseline values from NC Register Dashboard scan. */
const AUDIT = {
    o34TotalCopq: '321762.5899',
    t13BeforeQa: '583944.0492',
    t5QaSaved: '211008.8452771799',
    workbookName: 'NC REGISTER - BMC/QC/05',
    workbookModifiedTime: '2026-06-18T12:32:01.665Z',
    referenceDate: '2026-06-18',
};
const NC_VALUES = [
    ['Timestamp', 'NC Number', 'NC DATE', 'FINAL COPQ'],
    ['2026-04-10', 'NC-001', '2026-04-10', 100000],
    ['2026-05-15', 'NC-002', '2026-05-15', 50000],
    ['2026-06-05', 'NC-003', '2026-06-05', 30000],
    ['2026-06-12', 'NC-004', '2026-06-12', 20000],
];
async function main() {
    const sources = await DataSourceRepository.activeSources();
    const source = sources.find((candidate) => candidate.code === 'COPQ_DASHBOARD_SHEET');
    if (!source)
        throw new Error('COPQ_DASHBOARD_SHEET not found');
    const parsedNc = parseNcCopqRecords(NC_VALUES, {
        copqColumn: 'FINAL COPQ',
        dateColumn: 'NC DATE',
        sourceKeyColumn: 'NC Number',
    });
    const periods = calculateCopqPeriodTotals(parsedNc.records, AUDIT.referenceDate);
    if (!periods)
        throw new Error('Failed to calculate COPQ periods');
    const normalized = {
        copqCost: AUDIT.o34TotalCopq,
        totalCopq: AUDIT.o34TotalCopq,
        copqValue: AUDIT.o34TotalCopq,
        copqYtd: AUDIT.o34TotalCopq,
        copqMtd: String(periods.copqMtd),
        copqQtd: String(periods.copqQtd),
        copqBeforeQaClearance: AUDIT.t13BeforeQa,
        qaSavedAmount: AUDIT.t5QaSaved,
        sourceWorkbookName: AUDIT.workbookName,
        sourceSheetName: 'Dashboard',
        sourceCell: 'O34',
        sourceCellFormula: '=G167',
        sourceCellValueType: 'formula',
        copqBeforeQaClearanceCell: 'T13',
        copqBeforeQaClearanceFormula: "='Form Responses 1'!BC1",
        sourceWorkbookModifiedTime: AUDIT.workbookModifiedTime,
        sourceLastUpdatedAt: AUDIT.workbookModifiedTime,
        qaSavedAmountCell: 'T5',
        qaSavedAmountFormula: "='Form Responses 1'!BC1-'Form Responses 1'!AT1",
        ncRecordsSheetName: 'Form Responses 1',
        ncDateColumnUsed: parsedNc.dateColumnUsed,
        ncCopqColumnUsed: parsedNc.copqColumnUsed,
        copqReferenceDate: AUDIT.referenceDate,
        copqFinancialYearStart: periods.financialYearStart,
        copqQuarterStart: periods.quarterStart,
        copqMonthStart: periods.monthStart,
        copqMtdRowCount: String(periods.mtdRowCount),
        copqQtdRowCount: String(periods.qtdRowCount),
        copqFyRowCount: String(periods.fyRowCount),
        copqMtdSourceKeys: periods.mtdSourceKeys.join(','),
        copqQtdSourceKeys: periods.qtdSourceKeys.join(','),
        copqFySourceKeys: periods.fySourceKeys.join(','),
        copqFyCalculatedTotal: String(parsedNc.records
            .filter((record) => record.ncDate >= periods.financialYearStart && record.ncDate <= AUDIT.referenceDate)
            .reduce((sum, record) => sum + record.finalCopq, 0)),
    };
    const payloadContent = JSON.stringify({ audit: true, normalized });
    const checksum = createHash('sha256').update(payloadContent).digest('hex');
    await transaction(async (connection) => {
        await UploadedFileRepository.create({
            dataSourceId: source.id,
            providerFileId: `${source.locationRef}:audit-seed:${Date.now()}`,
            fileName: AUDIT.workbookName,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            checksum,
            modifiedTime: new Date(AUDIT.workbookModifiedTime),
            sizeBytes: null,
            status: ProcessingStatus.SUCCESS,
        }, connection);
        await StagingRecordRepository.createMany([{
                dataSourceId: source.id,
                sourceDate: new Date(AUDIT.workbookModifiedTime),
                sourceKey: 'Dashboard!O34',
                normalized,
                raw: { type: 'copqAuditSeed', normalized },
            }], connection);
    });
    await new KpiCalculationService().calculateAndPersist();
    const kpi = await buildCopqKpi();
    console.log('\n=== SOURCE VALIDATION ===');
    console.log(JSON.stringify({
        headlineSourceCell: 'O34',
        ytdSourceCell: 'O34',
        ytdSourceValue: AUDIT.o34TotalCopq,
        t13BeforeQaClearance: AUDIT.t13BeforeQa,
        t5QaSaved: AUDIT.t5QaSaved,
        mtdCalculation: {
            filter: `${periods.monthStart} → ${AUDIT.referenceDate}`,
            rowCount: periods.mtdRowCount,
            sourceKeys: periods.mtdSourceKeys,
            value: periods.copqMtd,
        },
        qtdCalculation: {
            filter: `${periods.quarterStart} → ${AUDIT.referenceDate}`,
            rowCount: periods.qtdRowCount,
            sourceKeys: periods.qtdSourceKeys,
            value: periods.copqQtd,
        },
        qaSavedSourceCell: 'T5',
        previousValueSource: 'prior kpi_values row with sourceCell=O34',
        trendSource: 'kpi_values history filtered to sourceCell=O34 only',
    }, null, 2));
    console.log('\n=== FINAL KPI CARD VALUES ===');
    console.log(JSON.stringify({
        headline: kpi?.value,
        ytdBadge: kpi?.subMetrics?.find((m) => m.key === 'ytd')?.value,
        qtdPill: kpi?.subMetrics?.find((m) => m.key === 'qtd')?.value,
        mtdPill: kpi?.subMetrics?.find((m) => m.key === 'mtd')?.value,
        qaSavedPill: kpi?.subMetrics?.find((m) => m.key === 'qaSaved')?.value,
        beforeQaPill: kpi?.subMetrics?.find((m) => m.key === 'beforeQa')?.value,
        previous: kpi?.previousValue,
        trendPercent: kpi?.changePercent,
        headlineUsesT13: kpi?.metadata?.sourceCell === 'T13',
        metadataSourceCell: kpi?.metadata?.sourceCell,
    }, null, 2));
}
main()
    .then(async () => closePool())
    .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
});
