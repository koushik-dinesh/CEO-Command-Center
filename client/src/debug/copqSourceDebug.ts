import type { CommandCenterResponse } from '../types/command-center';

function isDashValue(value: number | null | undefined): boolean {
  return value === null || value === undefined || Number.isNaN(value);
}

function explainDash(field: string, value: number | null | undefined, reason: string) {
  if (!isDashValue(value)) return null;
  return { field, value, reason, displaysAs: '—' };
}

export function logCopqSourceDebug(data: Pick<CommandCenterResponse, 'copqSourceDebug' | 'kpis'>): void {
  const debug = data.copqSourceDebug;
  const copqKpi = data.kpis.find((kpi) => kpi.key === 'copq') ?? null;

  console.log('=== COPQ SOURCE DEBUG ===');
  if (!debug) {
    console.log('copqSourceDebug payload missing from API response');
    console.log('Final KPI Object:', copqKpi);
    return;
  }

  console.log('Generated At:', debug.generatedAt);
  console.log('Data Source:', debug.dataSource);

  for (const dataset of debug.datasets) {
    console.log('---');
    console.log('Source File:', dataset.fileName);
    console.log('Source Name:', dataset.sourceName);
    console.log('Sheet:', dataset.sheetName);
    console.log('Range:', dataset.range);
    if (dataset.cells) {
      console.log('Dashboard Cells:', dataset.cells);
      console.log('Dashboard!O34 Raw:', dataset.cells.totalCopq?.raw ?? dataset.cells.totalCopq?.formatted ?? null);
      console.log('Dashboard!O34 Parsed:', dataset.cells.totalCopq?.parsed ?? null);
      console.log('Dashboard!T13 Raw:', dataset.cells.copqBeforeQaClearance?.raw ?? dataset.cells.copqBeforeQaClearance?.formatted ?? null);
      console.log('Dashboard!T13 Parsed:', dataset.cells.copqBeforeQaClearance?.parsed ?? null);
      console.log('Dashboard!T5 Raw:', dataset.cells.qaSavedAmount?.raw ?? dataset.cells.qaSavedAmount?.formatted ?? null);
      console.log('Dashboard!T5 Parsed:', dataset.cells.qaSavedAmount?.parsed ?? null);
    }
    console.log('Column Headers:', dataset.headers);
    console.log('Row Count:', dataset.rowCount);
    console.log('First 20 Rows:', dataset.rowsPreview);
  }

  console.log('--- MAPPINGS ---');
  console.log('COPQ YTD:', debug.mappings.copqYtd);
  console.log('COPQ MTD:', debug.mappings.copqMtd);
  console.log('COPQ QTD:', debug.mappings.copqQtd);
  console.log('QA Saved:', debug.mappings.qaSaved);
  console.log('Before QA Clearance:', debug.mappings.beforeQaClearance);

  console.log('--- DATABASE ---');
  console.log('Latest KPI Value Row:', debug.database.latestKpiValue);
  console.log('Latest Staging Record:', debug.database.latestStaging);

  console.log('--- LIVE FETCH ---');
  console.log('Live Fetch:', debug.liveFetch);
  if (debug.liveFetch.dashboardCells?.totalCopq) {
    console.log('Live Dashboard!O34 Raw:', debug.liveFetch.dashboardCells.totalCopq.raw);
    console.log('Live Dashboard!O34 Parsed:', debug.liveFetch.dashboardCells.totalCopq.parsed);
  }
  if (debug.liveFetch.normalizedPreview) {
    console.log('Live Normalized Preview:', debug.liveFetch.normalizedPreview);
  }

  console.log('--- FINAL KPI CARD ---');
  console.log('COPQ YTD:', copqKpi?.subMetrics?.find((metric) => metric.key === 'ytd')?.value ?? copqKpi?.value ?? null);
  console.log('COPQ QTD:', copqKpi?.subMetrics?.find((metric) => metric.key === 'qtd')?.value ?? null);
  console.log('COPQ MTD:', copqKpi?.subMetrics?.find((metric) => metric.key === 'mtd')?.value ?? null);
  console.log('QA Saved:', copqKpi?.subMetrics?.find((metric) => metric.key === 'qaSaved')?.value ?? null);
  console.log('Final KPI Object:', debug.finalKpiCard ?? copqKpi);

  if (copqKpi) {
    console.log('COPQ HEADLINE SOURCE', {
      cell: 'O34',
      label: 'TOTAL COPQ',
      value: copqKpi.value,
    });
    console.log('COPQ KPI SOURCE', {
      sourceCell: copqKpi.metadata?.sourceCell,
      value: copqKpi.value,
      metadata: copqKpi.metadata,
    });
  }

  const fallbacks = [
    explainDash('headline', copqKpi?.value ?? null, 'PrecisionValue shows — when value is null/NaN'),
    explainDash('previous', copqKpi?.previousValue ?? null, 'HeroKpiGrid previous value uses PrecisionValue when no compact previous display'),
    explainDash('changePercent', copqKpi?.changePercent ?? null, 'HeroKpiGrid trend pill uses explicit display "—" when changePercent is null'),
    ...(copqKpi?.subMetrics ?? []).map((metric) =>
      explainDash(`subMetric.${metric.key}`, metric.value, 'KpiSubMetrics formatPillDisplay returns — when sub-metric value is null'),
    ),
  ].filter(Boolean);

  console.log('--- FALLBACKS TO — ---');
  console.log(fallbacks);
  console.log('=== END COPQ SOURCE DEBUG ===');
}
