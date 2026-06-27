import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { KpiCardData } from '../../types';
import { formatChangePercent, formatDateTime, formatKpiValue } from '../../utils/formatters';

const trendCopy = {
  UP: 'Increasing',
  DOWN: 'Decreasing',
  FLAT: 'Stable',
  UNKNOWN: 'New',
};

const trendClass = {
  UP: 'trend-up',
  DOWN: 'trend-down',
  FLAT: 'trend-flat',
  UNKNOWN: 'trend-unknown',
};

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function formatTooltipNumber(value: unknown): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? '');
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(numericValue);
}

function SparklineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number; payload?: { calculatedAt?: string } }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const dateLabel = point.payload?.calculatedAt ?? 'Date unavailable';
  return (
    <div className="sparkline-tooltip rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-primary-theme">{dateLabel}</p>
      <p className="mt-1 text-secondary-theme">{formatTooltipNumber(point.value)}</p>
    </div>
  );
}

export default function KpiCard({ kpi }: { kpi: KpiCardData }) {
  const chartData = kpi.history.map((point) => ({ calculatedAt: formatDateTime(point.calculatedAt), value: Number(point.value) }));
  const chartValues = chartData.map((point) => point.value).filter((value) => Number.isFinite(value));
  const minChartValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxChartValue = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const valueRange = maxChartValue - minChartValue;
  const yAxisPadding = Math.max(valueRange * 0.15, Math.abs(maxChartValue) * 0.0025, 1);
  const yAxisDomain: [number, number] = [minChartValue - yAxisPadding, maxChartValue + yAxisPadding];

  return (
    <section className="kpi-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-theme">{kpi.name}</h2>
          <p className="mt-3 text-3xl font-semibold text-primary-theme">{formatKpiValue(kpi.currentValue, kpi.displayFormat)}</p>
        </div>
        <span className={`trend-badge px-3 py-1 text-xs ${trendClass[kpi.trendDirection]}`}>{trendCopy[kpi.trendDirection]}</span>
      </div>

      <p className="mt-3 min-h-10 text-sm leading-5 text-secondary-theme">{kpi.description}</p>


      {kpi.code === 'REVENUE' && kpi.metadataJson ? (
        <div className="metadata-panel mt-4 grid grid-cols-1 gap-3 rounded-xl p-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-muted-theme">MTD Revenue</p>
              <p className="mt-1 text-primary-theme">{formatKpiValue(metadataString(kpi.metadataJson, 'revenueMtd'), 'currency')}</p>
            </div>
            <div>
              <p className="text-muted-theme">QTD Revenue</p>
              <p className="mt-1 text-primary-theme">{formatKpiValue(metadataString(kpi.metadataJson, 'revenueQtd'), 'currency')}</p>
            </div>
            <div>
              <p className="text-muted-theme">YTD Revenue</p>
              <p className="mt-1 text-primary-theme">{formatKpiValue(metadataString(kpi.metadataJson, 'revenueYtd'), 'currency')}</p>
            </div>
          </div>
          {metadataString(kpi.metadataJson, 'sourceFileName') ? (
            <div>
              <p className="text-muted-theme">Source file</p>
              <p className="mt-1 break-all text-xs text-secondary-theme">{metadataString(kpi.metadataJson, 'sourceFileName')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {kpi.code === 'COPQ' && kpi.metadataJson ? (
        <div className="metadata-panel mt-4 grid grid-cols-1 gap-3 rounded-xl p-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-theme">Source workbook</p>
              <p className="mt-1 break-all text-xs text-secondary-theme">{metadataString(kpi.metadataJson, 'sourceWorkbookName') ?? 'Unavailable'}</p>
            </div>
            <div>
              <p className="text-muted-theme">Source sheet</p>
              <p className="mt-1 text-primary-theme">{metadataString(kpi.metadataJson, 'sourceSheetName') ?? 'Unavailable'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-theme">YTD COPQ (Dashboard)</p>
              <p className="mt-1 text-primary-theme">{formatKpiValue(metadataString(kpi.metadataJson, 'copqYtd') ?? metadataString(kpi.metadataJson, 'totalCopq'), 'currency')}</p>
            </div>
            <div>
              <p className="text-muted-theme">MTD / QTD COPQ</p>
              <p className="mt-1 text-primary-theme">
                {formatKpiValue(metadataString(kpi.metadataJson, 'copqMtd'), 'currency')}
                {' / '}
                {formatKpiValue(metadataString(kpi.metadataJson, 'copqQtd'), 'currency')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-theme">Source cell</p>
              <p className="mt-1 text-primary-theme">{metadataString(kpi.metadataJson, 'sourceCell') ?? 'Unavailable'}</p>
            </div>
            <div>
              <p className="text-muted-theme">QA saved amount</p>
              <p className="mt-1 text-primary-theme">{formatKpiValue(metadataString(kpi.metadataJson, 'qaSavedAmount'), 'currency')}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
        <div>
          <p className="text-muted-theme">Last updated</p>
          <p className="mt-1 text-secondary-theme">{formatDateTime(kpi.lastUpdatedAt)}</p>
        </div>
        <div>
          <p className="text-muted-theme">Comparison</p>
          <p className="mt-1 text-secondary-theme">{formatChangePercent(kpi.changePercent)}</p>
        </div>
      </div>

      {chartData.length > 1 ? (
        <div className="mt-4 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <YAxis hide domain={yAxisDomain} />
              <Tooltip content={<SparklineTooltip />} />
              <Line type="monotone" dataKey="value" className="chart-line-theme" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : kpi.historyNote ? (
        <p className="history-note mt-4 rounded-lg px-3 py-2 text-xs">{kpi.historyNote}</p>
      ) : null}

      {kpi.status !== 'CURRENT' ? <p className="status-note mt-4 rounded-lg px-3 py-2 text-xs">Status: {kpi.status.toLowerCase()}</p> : null}
    </section>
  );
}
