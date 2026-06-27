import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closePool, execute, queryOne, transaction } from '../src/db/mysql.js';
import { createId } from '../src/db/ids.js';
import { stringifyJson } from '../src/db/json.js';
import { SourceProvider, SourceType } from '../src/db/types.js';
import type { RowDataPacket } from 'mysql2';

interface IdRow extends RowDataPacket {
  id: string;
}

const dataSources = [
  {
    code: 'REVENUE_CSV',
    name: 'Revenue CSV',
    sourceType: SourceType.CSV,
    provider: SourceProvider.GOOGLE_DRIVE,
    locationRef: '1Iub_F2LioHu3c0lZczrhrC-KaJlQKtmw',
    configJson: { fileNamePattern: 'Sales_Revenue_by_Customer_Group', columns: { sourceKey: 'Customer Group Code', sourceName: 'Customer Group Name', revenueMtd: 'MTD Revenue (?)', revenueQtd: 'QTD Revenue (?)', revenueYtd: 'YTD Revenue (?)' } },
  },
  {
    code: 'SAP_EXPORT_CSV',
    name: 'SAP Export CSV',
    sourceType: SourceType.CSV,
    provider: SourceProvider.GOOGLE_DRIVE,
    locationRef: '1Iub_F2LioHu3c0lZczrhrC-KaJlQKtmw',
    configJson: { fileNamePattern: 'sap', dateColumn: 'date', columns: { revenue: 'revenue', cogs: 'cogs', sourceKey: 'documentNumber' } },
  },
  {
    code: 'INVENTORY_CSV',
    name: 'Inventory CSV',
    sourceType: SourceType.CSV,
    provider: SourceProvider.GOOGLE_DRIVE,
    locationRef: '1Iub_F2LioHu3c0lZczrhrC-KaJlQKtmw',
    configJson: { fileNamePattern: 'inventory', dateColumn: 'date', columns: { inventoryValue: 'inventoryValue', sourceKey: 'itemCode' } },
  },
  {
    code: 'COPQ_DASHBOARD_SHEET',
    name: 'NC Register Dashboard Sheet',
    sourceType: SourceType.GOOGLE_SHEET,
    provider: SourceProvider.GOOGLE_SHEETS,
    locationRef: '1CBrM7pIT10Egk-D9rD5d43Ry7AxxFP7LXJapGUu6Vvg',
    configJson: {
      dashboardSheetName: 'Dashboard',
      totalCopqCell: 'O34',
      totalCopqLabelCell: 'O31',
      copqCell: 'T13',
      qaSavedAmountCell: 'T5',
      copqLabelCell: 'T11',
      qaSavedAmountLabelCell: 'T3',
      ncRecordsSheetName: 'Form Responses 1',
      ncRecordsRange: "'Form Responses 1'!A:BC",
      ncDateColumn: 'NC DATE',
      ncDateColumnFallbacks: ['Timestamp'],
      ncCopqColumn: 'FINAL COPQ',
      ncSourceKeyColumn: 'QC NC number',
      ncNumberColumn: 'QC NC number',
      columns: { copqCost: 'TOTAL COPQ', sourceKey: 'Dashboard!O34' },
    },
  },
  {
    code: 'HR_COST_SHEET',
    name: 'HR Cost Sheet',
    sourceType: SourceType.GOOGLE_SHEET,
    provider: SourceProvider.GOOGLE_SHEETS,
    locationRef: 'google-sheet-id-for-hr-cost',
    configJson: { range: 'HR Cost!A:B', dateColumn: 'period', columns: { hrCost: 'hrCost', sourceKey: 'department' } },
  },
];

const kpis = [
  { code: 'REVENUE', name: 'Revenue', description: 'Total recognized revenue for the current reporting period.', unit: 'INR', displayFormat: 'currency', calculationType: 'SUM', sortOrder: 1, sources: ['REVENUE_CSV', 'SAP_EXPORT_CSV'] },
  { code: 'INVENTORY_VALUE', name: 'Inventory Value', description: 'Latest available inventory valuation snapshot.', unit: 'INR', displayFormat: 'currency', calculationType: 'LATEST_SNAPSHOT', sortOrder: 2, sources: ['INVENTORY_CSV'] },
  { code: 'COGS', name: 'COGS', description: 'Total cost of goods sold for the current reporting period.', unit: 'INR', displayFormat: 'currency', calculationType: 'SUM', sortOrder: 4, sources: ['SAP_EXPORT_CSV', 'REVENUE_CSV'] },
  { code: 'COPQ', name: 'COPQ', description: 'Total COPQ from the NC Register Dashboard sheet (Dashboard!O34).', unit: 'INR', displayFormat: 'currency', calculationType: 'SOURCE_VALUE', sortOrder: 5, sources: ['COPQ_DASHBOARD_SHEET'] },
  { code: 'REVENUE_HR_COST_RATIO', name: 'Revenue to HR Cost Ratio', description: 'Revenue divided by HR cost for the current reporting period.', unit: 'ratio', displayFormat: 'ratio', calculationType: 'RATIO', sortOrder: 6, sources: ['REVENUE_CSV', 'SAP_EXPORT_CSV', 'HR_COST_SHEET'] },
];

async function findIdByCode(table: string, code: string): Promise<string> {
  const row = await queryOne<IdRow>(`SELECT id FROM ${table} WHERE code = ? LIMIT 1`, [code]);
  if (!row) throw new Error(`${table} row not found for code ${code}`);
  return row.id;
}

async function main() {
  const email = process.env.CEO_EMAIL ?? 'ceo@example.com';
  const password = process.env.CEO_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await transaction(async (connection) => {
    await execute(
      `INSERT INTO users (id, email, passwordHash, name, isActive)
       VALUES (?, ?, ?, 'CEO', TRUE)
       ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), name = VALUES(name), isActive = TRUE, updatedAt = UTC_TIMESTAMP(3)`,
      [createId('user'), email, passwordHash],
      connection,
    );

    for (const source of dataSources) {
      await execute(
        `INSERT INTO data_sources (id, code, name, sourceType, provider, locationRef, configJson, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), sourceType = VALUES(sourceType), provider = VALUES(provider), locationRef = VALUES(locationRef), configJson = VALUES(configJson), isActive = TRUE, updatedAt = UTC_TIMESTAMP(3)`,
        [createId('ds'), source.code, source.name, source.sourceType, source.provider, source.locationRef, stringifyJson(source.configJson)],
        connection,
      );
    }

    await execute(
      `UPDATE data_sources
       SET isActive = FALSE, locationRef = ?, updatedAt = UTC_TIMESTAMP(3)
       WHERE code = 'NC_REGISTER_CSV'`,
      ['1Iub_F2LioHu3c0lZczrhrC-KaJlQKtmw'],
      connection,
    );

    for (const kpi of kpis) {
      await execute(
        `INSERT INTO kpi_definitions (id, code, name, description, unit, displayFormat, calculationType, sortOrder, isActive, configJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), unit = VALUES(unit), displayFormat = VALUES(displayFormat), calculationType = VALUES(calculationType), sortOrder = VALUES(sortOrder), isActive = TRUE, configJson = VALUES(configJson), updatedAt = UTC_TIMESTAMP(3)`,
        [createId('kpi'), kpi.code, kpi.name, kpi.description, kpi.unit, kpi.displayFormat, kpi.calculationType, kpi.sortOrder, stringifyJson({ dependencies: kpi.sources })],
        connection,
      );
    }
  });

  await execute(
    `UPDATE kpi_definitions SET isActive = FALSE, updatedAt = UTC_TIMESTAMP(3) WHERE code = 'INVENTORY_TURNOVER_RATIO'`,
  );

  for (const kpi of kpis) {
    const kpiDefinitionId = await findIdByCode('kpi_definitions', kpi.code);
    for (const sourceCode of kpi.sources) {
      const dataSourceId = await findIdByCode('data_sources', sourceCode);
      await execute(
        `INSERT INTO kpi_dependencies (id, kpiDefinitionId, dataSourceId, isRequired)
         VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE isRequired = TRUE`,
        [createId('dep'), kpiDefinitionId, dataSourceId],
      );
    }
  }

  await execute(
    `DELETE dep FROM kpi_dependencies dep
     INNER JOIN kpi_definitions kpi ON kpi.id = dep.kpiDefinitionId
     INNER JOIN data_sources ds ON ds.id = dep.dataSourceId
     WHERE kpi.code = 'COPQ' AND ds.code = 'NC_REGISTER_CSV'`,
  );

  const layoutJson = { cards: kpis.map((kpi) => ({ code: kpi.code, width: 'third' })) };
  const existingDashboard = await queryOne<IdRow>('SELECT id FROM dashboard_configurations WHERE isDefault = TRUE LIMIT 1');
  if (existingDashboard) {
    await execute(
      'UPDATE dashboard_configurations SET name = ?, layoutJson = ?, refreshIntervalSeconds = ?, updatedAt = UTC_TIMESTAMP(3) WHERE id = ?',
      ['Dashboard', stringifyJson(layoutJson), 900, existingDashboard.id],
    );
  } else {
    await execute(
      'INSERT INTO dashboard_configurations (id, name, isDefault, layoutJson, refreshIntervalSeconds) VALUES (?, ?, TRUE, ?, ?)',
      [createId('dash'), 'Dashboard', stringifyJson(layoutJson), 900],
    );
  }
}

main()
  .then(async () => closePool())
  .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
  });
