import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../.env') });
import { google } from 'googleapis';
import { createGoogleAuth } from '../src/ingestion/googleAuth.js';
import { closePool, queryOne } from '../src/db/mysql.js';
const SPREADSHEET_ID = process.argv[2] ?? '1V28mVxJtrqlzvaUTZAogAiI1PjKF4SjdJIGZotaC5vk';
const TARGET_GID = Number(process.argv[3] ?? '1196535984');
const CELLS = ['O34', 'T13', 'T5', 'O31'];
async function main() {
    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    const meta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: 'properties.title,sheets.properties(sheetId,title,index)',
    });
    console.log(`Workbook: ${meta.data.properties?.title ?? SPREADSHEET_ID}`);
    const sheetProps = meta.data.sheets?.map((sheet) => sheet.properties).filter(Boolean) ?? [];
    console.log('\nSheets:');
    for (const sheet of sheetProps) {
        console.log(`  - ${sheet.title} (sheetId=${sheet.sheetId}, index=${sheet.index})`);
    }
    const gidSheet = sheetProps.find((sheet) => sheet.sheetId === TARGET_GID);
    if (gidSheet) {
        console.log(`\nURL gid ${TARGET_GID} matches tab: "${gidSheet.title}"`);
    }
    console.log('\nCell probe (values.batchGet UNFORMATTED_VALUE):');
    for (const sheet of sheetProps) {
        const title = sheet.title;
        const ranges = CELLS.map((cell) => `'${title}'!${cell}`);
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });
        const values = CELLS.map((cell, index) => ({
            cell,
            value: response.data.valueRanges?.[index]?.values?.[0]?.[0] ?? null,
        }));
        const hasData = values.some((entry) => entry.value !== null && entry.value !== '');
        if (hasData) {
            console.log(`\n[${title}]`);
            for (const entry of values) {
                console.log(`  ${entry.cell}: ${entry.value}`);
            }
        }
    }
    const dbRow = await queryOne(`SELECT locationRef, configJson FROM data_sources WHERE code = 'COPQ_DASHBOARD_SHEET' LIMIT 1`);
    console.log('\nDB locationRef:', dbRow?.locationRef ?? 'not found');
    console.log('DB config dashboardSheetName:', dbRow?.configJson?.dashboardSheetName ?? 'default Dashboard');
}
main()
    .then(async () => closePool())
    .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
});
