import { google } from 'googleapis';
import { recordGoogleDriveFetch, recordGoogleSheetsFetch } from './fetchActivityLog.js';
import { createGoogleAuth } from './googleAuth.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
function serializeExtendedValue(value) {
    if (!value || typeof value !== 'object')
        return null;
    const extendedValue = value;
    if (extendedValue.numberValue !== undefined)
        return extendedValue.numberValue;
    if (extendedValue.stringValue !== undefined)
        return extendedValue.stringValue;
    if (extendedValue.boolValue !== undefined)
        return extendedValue.boolValue;
    if (extendedValue.formulaValue !== undefined)
        return extendedValue.formulaValue;
    if (extendedValue.errorValue !== undefined)
        return extendedValue.errorValue;
    return null;
}
function parseCellRef(ref) {
    const match = /^([A-Z]+)(\d+)$/i.exec(ref);
    if (!match)
        throw new Error(`Invalid Google Sheets cell reference: ${ref}`);
    const columnIndex = [...match[1].toUpperCase()].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    return { rowIndex: Number(match[2]) - 1, columnIndex };
}
function columnName(index) {
    let n = index;
    let name = '';
    do {
        name = String.fromCharCode((n % 26) + 65) + name;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
}
function cellAt(rowData, startRow, startColumn, ref) {
    const { rowIndex, columnIndex } = parseCellRef(ref);
    const row = rowData[rowIndex - startRow];
    const cell = row?.values?.[columnIndex - startColumn];
    const formula = cell?.userEnteredValue?.formulaValue ?? null;
    const userEnteredValue = serializeExtendedValue(cell?.userEnteredValue);
    return {
        ref,
        formattedValue: cell?.formattedValue ?? null,
        effectiveValue: serializeExtendedValue(cell?.effectiveValue),
        userEnteredValue,
        formula,
        valueType: formula ? 'formula' : userEnteredValue === null ? 'empty' : 'static',
    };
}
export class GoogleSheetsService {
    sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    drive = google.drive({ version: 'v3', auth: createGoogleAuth() });
    async fetchRange(source) {
        if (source.code === 'COPQ_DASHBOARD_SHEET') {
            return this.fetchCopqDashboard(source);
        }
        const config = source.configJson;
        const range = config.range ?? 'Sheet1!A:Z';
        const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: source.locationRef, range });
        recordGoogleSheetsFetch('spreadsheets.values.get', source.code);
        const values = response.data.values ?? [];
        return {
            providerFileId: `${source.locationRef}:${range}`,
            fileName: `${source.name} ${range}`,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            modifiedTime: new Date(),
            content: JSON.stringify(values),
        };
    }
    spreadsheetGrid(spreadsheetId, range, sourceCode) {
        return this.sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: true,
            ranges: [range],
            fields: 'properties.title,sheets.properties.title,sheets.data.startRow,sheets.data.startColumn,sheets.data.rowData.values(formattedValue,userEnteredValue,effectiveValue)',
        });
    }
    async fetchCopqDashboard(source) {
        const config = source.configJson;
        const sheetName = config.dashboardSheetName ?? 'Dashboard';
        const totalCopqCell = config.totalCopqCell ?? 'O34';
        const totalCopqLabelCell = config.totalCopqLabelCell ?? 'O31';
        const copqCell = config.copqCell ?? 'T13';
        const qaSavedAmountCell = config.qaSavedAmountCell ?? 'T5';
        const copqLabelCell = config.copqLabelCell ?? 'T11';
        const qaSavedAmountLabelCell = config.qaSavedAmountLabelCell ?? 'T3';
        const ncRecordsSheetName = config.ncRecordsSheetName ?? 'Form Responses 1';
        const ncRecordsRange = config.ncRecordsRange ?? `'${ncRecordsSheetName}'!A:BC`;
        const refs = [
            totalCopqLabelCell,
            totalCopqCell,
            qaSavedAmountLabelCell,
            qaSavedAmountCell,
            copqLabelCell,
            copqCell,
        ];
        const rows = refs.map((ref) => parseCellRef(ref).rowIndex);
        const columns = refs.map((ref) => parseCellRef(ref).columnIndex);
        const startRow = Math.min(...rows);
        const endRow = Math.max(...rows) + 1;
        const startColumn = Math.min(...columns);
        const endColumn = Math.max(...columns) + 1;
        const dashboardRange = `${sheetName}!${columnName(startColumn)}${startRow + 1}:${columnName(endColumn - 1)}${endRow}`;
        const [file, dashboardGrid, ncRecordsResponse] = await Promise.all([
            this.drive.files.get({
                fileId: source.locationRef,
                fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
                supportsAllDrives: true,
            }),
            this.spreadsheetGrid(source.locationRef, dashboardRange, source.code),
            this.sheets.spreadsheets.values.get({
                spreadsheetId: source.locationRef,
                range: ncRecordsRange,
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING',
            }),
        ]);
        recordGoogleDriveFetch('files.get', source.code);
        recordGoogleSheetsFetch('spreadsheets.get', source.code);
        recordGoogleSheetsFetch('spreadsheets.values.get', source.code);
        const sheet = dashboardGrid.data.sheets?.find((candidate) => candidate.properties?.title === sheetName);
        if (!sheet)
            throw new Error(`Dashboard sheet not found: ${sheetName}`);
        const data = sheet.data?.[0];
        const rowData = data?.rowData ?? [];
        const dataStartRow = data?.startRow ?? startRow;
        const dataStartColumn = data?.startColumn ?? startColumn;
        const cells = {
            totalCopqLabel: cellAt(rowData, dataStartRow, dataStartColumn, totalCopqLabelCell),
            totalCopq: cellAt(rowData, dataStartRow, dataStartColumn, totalCopqCell),
            qaSavedAmountLabel: cellAt(rowData, dataStartRow, dataStartColumn, qaSavedAmountLabelCell),
            qaSavedAmount: cellAt(rowData, dataStartRow, dataStartColumn, qaSavedAmountCell),
            copqBeforeQaClearanceLabel: cellAt(rowData, dataStartRow, dataStartColumn, copqLabelCell),
            copqBeforeQaClearance: cellAt(rowData, dataStartRow, dataStartColumn, copqCell),
        };
        logO34Stage('FETCH O34', cells.totalCopq, cells);
        console.info(`[ingestion:copq] Workbook loaded: ${file.data.name} (${source.locationRef})`);
        console.info(`[ingestion:copq] Dashboard sheet found: ${sheetName}`);
        console.info(`[ingestion:copq] Total COPQ extracted: ${sheetName}!${totalCopqCell}=${cells.totalCopq.effectiveValue}`);
        console.info(`[ingestion:copq] Before QA clearance: ${sheetName}!${copqCell}=${cells.copqBeforeQaClearance.effectiveValue}`);
        console.info(`[ingestion:copq] QA saved amount: ${sheetName}!${qaSavedAmountCell}=${cells.qaSavedAmount.effectiveValue}`);
        const ncRecordRows = ncRecordsResponse.data.values?.length ?? 0;
        console.info(`[ingestion:copq] NC records loaded: ${ncRecordsSheetName} rows=${Math.max(0, ncRecordRows - 1)}`);
        return {
            providerFileId: `${source.locationRef}:${sheetName}!${totalCopqCell}`,
            fileName: file.data.name ?? source.name,
            mimeType: file.data.mimeType ?? 'application/vnd.google-apps.spreadsheet',
            modifiedTime: file.data.modifiedTime ? new Date(file.data.modifiedTime) : new Date(),
            sizeBytes: file.data.size ? BigInt(file.data.size) : undefined,
            content: JSON.stringify({
                type: 'copqDashboard',
                spreadsheetId: source.locationRef,
                workbookName: file.data.name ?? source.name,
                workbookModifiedTime: file.data.modifiedTime ?? null,
                webViewLink: file.data.webViewLink ?? null,
                sheetName,
                range: dashboardRange,
                cells,
                ncRecords: {
                    sheetName: ncRecordsSheetName,
                    range: ncRecordsRange,
                    values: ncRecordsResponse.data.values ?? [],
                },
                extractionLog: [
                    `Workbook loaded: ${file.data.name ?? source.name}`,
                    `Dashboard sheet found: ${sheetName}`,
                    `Total COPQ extracted: ${sheetName}!${totalCopqCell}=${cells.totalCopq.effectiveValue}`,
                    `Before QA clearance extracted: ${sheetName}!${copqCell}=${cells.copqBeforeQaClearance.effectiveValue}`,
                    `QA saved amount extracted: ${sheetName}!${qaSavedAmountCell}=${cells.qaSavedAmount.effectiveValue}`,
                    `NC records loaded from ${ncRecordsSheetName}: ${Math.max(0, ncRecordRows - 1)} data rows`,
                ],
            }),
        };
    }
}
