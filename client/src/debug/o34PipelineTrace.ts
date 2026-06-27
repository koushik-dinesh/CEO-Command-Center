import type { KpiMetric } from '../types/command-center';

export function logFrontendO34(stage: string, payload: unknown, keysSource?: Record<string, unknown> | null): void {
  console.log(stage, payload);
  if (keysSource && typeof keysSource === 'object') {
    console.log('AVAILABLE KEYS', Object.keys(keysSource));
  }
}

export function traceCopqMetricFromResponse(kpis: KpiMetric[]): void {
  const copqMetric = kpis.find((kpi) => kpi.key === 'copq') ?? null;
  logFrontendO34('FRONTEND O34', {
    value: copqMetric?.value ?? null,
    sourceCell: copqMetric?.metadata?.sourceCell ?? null,
    copqYtd: copqMetric?.metadata?.copqYtd ?? null,
    ytdSubMetric: copqMetric?.subMetrics?.find((metric) => metric.key === 'ytd')?.value ?? null,
  }, (copqMetric?.metadata ?? {}) as Record<string, unknown>);
}

export function traceCopqKpiCardProps(kpi: KpiMetric): void {
  logFrontendO34('KPI CARD PROPS O34', {
    key: kpi.key,
    value: kpi.value,
    unit: kpi.unit,
    sourceCell: kpi.metadata?.sourceCell ?? null,
    copqYtd: kpi.metadata?.copqYtd ?? null,
    ytdSubMetric: kpi.subMetrics?.find((metric) => metric.key === 'ytd')?.value ?? null,
    subMetricKeys: kpi.subMetrics?.map((metric) => metric.key) ?? [],
  }, (kpi.metadata ?? {}) as Record<string, unknown>);
}
