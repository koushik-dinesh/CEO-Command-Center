/** COPQ dashboard headline fields persisted in copq_analytics_meta.headlineJson. */
export function extractCopqHeadline(normalized) {
    return {
        totalCopq: normalized.totalCopq ?? normalized.copqYtd ?? null,
        copqYtd: normalized.copqYtd ?? normalized.totalCopq ?? null,
        copqMtd: normalized.copqMtd ?? null,
        copqQtd: normalized.copqQtd ?? null,
        copqBeforeQaClearance: normalized.copqBeforeQaClearance ?? null,
        qaSavedAmount: normalized.qaSavedAmount ?? null,
        sourceWorkbookName: normalized.sourceWorkbookName ?? null,
        sourceSheetName: normalized.sourceSheetName ?? null,
        sourceCell: normalized.sourceCell ?? null,
        sourceCellFormula: normalized.sourceCellFormula ?? null,
        sourceCellValueType: normalized.sourceCellValueType ?? null,
        copqBeforeQaClearanceCell: normalized.copqBeforeQaClearanceCell ?? null,
        copqBeforeQaClearanceFormula: normalized.copqBeforeQaClearanceFormula ?? null,
        qaSavedAmountCell: normalized.qaSavedAmountCell ?? null,
        qaSavedAmountFormula: normalized.qaSavedAmountFormula ?? null,
        sourceWorkbookModifiedTime: normalized.sourceWorkbookModifiedTime ?? null,
        sourceLastUpdatedAt: normalized.sourceLastUpdatedAt ?? normalized.sourceWorkbookModifiedTime ?? null,
        ncRecordsSheetName: normalized.ncRecordsSheetName ?? null,
        copqReferenceDate: normalized.copqReferenceDate ?? null,
        copqFinancialYearStart: normalized.copqFinancialYearStart ?? null,
        copqQuarterStart: normalized.copqQuarterStart ?? null,
        copqMonthStart: normalized.copqMonthStart ?? null,
        copqMtdRowCount: normalized.copqMtdRowCount ?? null,
        copqQtdRowCount: normalized.copqQtdRowCount ?? null,
        copqFyRowCount: normalized.copqFyRowCount ?? null,
        copqMtdSourceKeys: normalized.copqMtdSourceKeys ?? null,
        copqQtdSourceKeys: normalized.copqQtdSourceKeys ?? null,
        copqFySourceKeys: normalized.copqFySourceKeys ?? null,
        copqFyCalculatedTotal: normalized.copqFyCalculatedTotal ?? null,
    };
}
export function copqHeadlineToSourceRecord(headline) {
    return {
        sourceDate: new Date(),
        normalized: headline,
    };
}
