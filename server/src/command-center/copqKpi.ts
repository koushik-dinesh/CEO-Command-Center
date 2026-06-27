import { enrichCopqMetadataFromStaging } from '../copq/copqStagingEnrichment.js';
import { filterO34CopqHistory, metadataString, resolveCopqHeadlineValue } from '../copq/copqKpiValue.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
import { KpiRepository } from '../repositories/KpiRepository.js';
import { buildCopqSubMetrics, buildKpi } from './insights.js';
import type { KpiMetric, MetricTrendPoint } from './types.js';

function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


function resolveCopqPreviousValue(
  latestHeadline: number | null,
  historyRows: Awaited<ReturnType<typeof KpiRepository.history>>,
): number | null {
  const o34History = filterO34CopqHistory(historyRows);
  if (o34History.length >= 2) {
    return parseDecimal(o34History[1].valueDecimal);
  }

  const previousStored = parseDecimal(o34History[0]?.previousValueDecimal ?? null);
  if (latestHeadline != null && previousStored != null && previousStored !== latestHeadline) {
    return previousStored;
  }

  return null;
}

export async function buildCopqKpi(): Promise<KpiMetric | null> {
  const latest = await KpiRepository.latestValueByCode('COPQ');
  if (!latest) return null;

  const { definition, value } = latest;
  logO34Stage('KPI BUILD O34 INPUT', {
    valueDecimal: value.valueDecimal,
    metadataSourceCell: metadataString(value.metadataJson, 'sourceCell'),
    metadataTotalCopq: metadataString(value.metadataJson, 'totalCopq'),
    metadataCopqYtd: metadataString(value.metadataJson, 'copqYtd'),
  }, (value.metadataJson ?? {}) as Record<string, unknown>);

  const enrichedMetadata = await enrichCopqMetadataFromStaging(value.metadataJson);
  const historyRows = await KpiRepository.history(definition.id, 48);
  const o34HistoryRows = filterO34CopqHistory(historyRows);

  const history: MetricTrendPoint[] = (o34HistoryRows.length > 0 ? o34HistoryRows : [])
    .slice()
    .reverse()
    .map((point) => ({
      snapshotKey: point.calculatedAt.toISOString(),
      snapshotDate: point.calculatedAt.toISOString().slice(0, 10),
      value: parseDecimal(point.valueDecimal) ?? 0,
    }))
    .filter((point) => point.value > 0);

  const current = resolveCopqHeadlineValue({
    valueDecimal: value.valueDecimal,
    metadata: enrichedMetadata,
  });
  const previous = resolveCopqPreviousValue(current, historyRows);

  const kpi: KpiMetric = {
    ...buildKpi('copq', definition.name, current, previous, 'currency', history),
    subMetrics: buildCopqSubMetrics(enrichedMetadata, current),
    footnote: 'NC Register Dashboard · TOTAL COPQ (Dashboard!O34)',
    metadata: {
      sourceWorkbook: metadataString(enrichedMetadata, 'sourceWorkbookName'),
      sourceSheet: metadataString(enrichedMetadata, 'sourceSheetName'),
      sourceCell: 'O34',
      ytdSourceCell: 'O34',
      ytdSourceLabel: 'TOTAL COPQ',
      qaSavedSourceCell: metadataString(enrichedMetadata, 'qaSavedAmountCell') ?? 'T5',
      beforeQaSourceCell: metadataString(enrichedMetadata, 'copqBeforeQaClearanceCell') ?? 'T13',
      copqMtd: metadataString(enrichedMetadata, 'copqMtd'),
      copqQtd: metadataString(enrichedMetadata, 'copqQtd'),
      copqYtd: current != null ? String(current) : null,
      qaSavedAmount: metadataString(enrichedMetadata, 'qaSavedAmount'),
      beforeQaClearance: metadataString(enrichedMetadata, 'copqBeforeQaClearance'),
      mtdSourceKeys: metadataString(enrichedMetadata, 'copqMtdSourceKeys'),
      qtdSourceKeys: metadataString(enrichedMetadata, 'copqQtdSourceKeys'),
      lastUpdatedAt: metadataString(enrichedMetadata, 'sourceLastUpdatedAt') ?? value.calculatedAt.toISOString(),
    },
    drilldownPath: '/intelligence/copq',
  };

  logO34Stage('KPI BUILD O34', {
    value: kpi.value,
    sourceCell: kpi.metadata?.sourceCell,
    copqYtd: kpi.metadata?.copqYtd,
    ytdSubMetric: kpi.subMetrics?.find((metric) => metric.key === 'ytd')?.value ?? null,
  }, (kpi.metadata ?? {}) as Record<string, unknown>);

  return kpi;
}
