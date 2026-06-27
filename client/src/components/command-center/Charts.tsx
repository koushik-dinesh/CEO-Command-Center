import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import type { MetricTrendPoint } from '../../types/command-center';
import { formatChartDateLabel, formatDateTime } from '../../utils/formatters';
import {
  DEFAULT_INVENTORY_DAYS_TARGET_MAX,
  DEFAULT_INVENTORY_DAYS_TARGET_MIN,
  evaluateTargetRangeHealth,
  healthToChartSentiment,
  resolveTrendSentimentFromValues,
  sentimentColor,
  sentimentGlow,
  type ChartSentiment,
  type KpiTrendDirection,
} from '../../config/kpiSemantics';
import {
  formatCompactCurrency,
  formatCompactDays,
  formatCompactRatio,
  formatExactCurrency,
  formatExactPercent,
  formatPercent,
  sparklineDomain,
} from '../../utils/command-center';
import PrecisionValue from '../ui/PrecisionValue';

function ChartValueTooltip({
  label,
  value,
  valueKind,
  display,
}: {
  label: string;
  value: number;
  valueKind: 'currency' | 'percent';
  display: string;
}) {
  const exact = valueKind === 'percent' ? formatExactPercent(value) : formatExactCurrency(value);

  return (
    <div className="sparkline-tooltip rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-theme">{label}</p>
      <p className="font-semibold text-primary-theme">{display}</p>
      <p className="sparkline-tooltip-exact">{exact}</p>
    </div>
  );
}

export function MiniSparkline({
  data,
  unit = 'currency',
  chartSentiment = 'neutral',
}: {
  data: MetricTrendPoint[];
  unit?: 'currency' | 'percent' | 'days' | 'ratio';
  chartSentiment?: ChartSentiment;
}) {
  if (data.length < 2) return <div className="cc-sparkline-empty">—</div>;
  const values = data.map((point) => point.value);
  const domain = sparklineDomain(values);
  const formatter = unit === 'percent'
    ? (v: number | null) => formatPercent(v, 1)
    : unit === 'days'
      ? formatCompactDays
      : unit === 'ratio'
        ? formatCompactRatio
        : formatCompactCurrency;
  const tooltipKind: 'currency' | 'percent' = unit === 'percent' ? 'percent' : 'currency';
  const strokeColor = sentimentColor(chartSentiment);
  const glow = sentimentGlow(chartSentiment);

  return (
    <div className={`cc-sparkline cc-sparkline-${chartSentiment}`}>
      <ResponsiveContainer width="100%" height={44}>
        <LineChart data={data}>
          <YAxis hide domain={domain} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            style={{ filter: glow }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const point = payload[0].payload as MetricTrendPoint;
              const value = Number(payload[0].value);
              return (
                <ChartValueTooltip
                  label={formatDateTime(point.snapshotKey || point.snapshotDate)}
                  value={value}
                  valueKind={tooltipKind}
                  display={formatter(value)}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendAreaChart({
  data,
  dataKey = 'value',
  height = 220,
  formatter = formatCompactCurrency,
  valueKind = 'currency',
  color,
  chartSentiment = 'neutral',
  trendDirection,
  evaluationType,
  improvementDirection,
  currentValue,
  previousValue,
  targetMinDays,
  targetMaxDays,
  curveType = 'monotone',
  showDots = false,
  snapshotXAxis = false,
  debugLabel,
}: {
  data: MetricTrendPoint[];
  dataKey?: string;
  height?: number;
  formatter?: (value: number | null) => string;
  valueKind?: 'currency' | 'percent';
  color?: string;
  chartSentiment?: ChartSentiment;
  trendDirection?: KpiTrendDirection;
  /** @deprecated Use trendDirection */
  evaluationType?: KpiTrendDirection;
  improvementDirection?: 'higher' | 'lower';
  currentValue?: number | null;
  previousValue?: number | null;
  targetMinDays?: number;
  targetMaxDays?: number;
  /** linear = straight segments between real points only; monotone = curved interpolation between points */
  curveType?: 'monotone' | 'linear';
  showDots?: boolean;
  /** Use snapshotKey as categorical X-axis (one slot per snapshot batch; no time-scale interpolation) */
  snapshotXAxis?: boolean;
  debugLabel?: string;
}) {
  if (data.length === 0) {
    return <div className="cc-chart-empty">Not enough history available</div>;
  }

  const resolvedTrendDirection: KpiTrendDirection | undefined = trendDirection
    ?? evaluationType
    ?? (improvementDirection === 'lower' ? 'lower_is_better' : improvementDirection === 'higher' ? 'higher_is_better' : undefined);

  const resolvedSentiment: ChartSentiment = resolvedTrendDirection === 'target_range'
    ? healthToChartSentiment(evaluateTargetRangeHealth(
      currentValue ?? data[data.length - 1]?.value ?? null,
      targetMinDays ?? DEFAULT_INVENTORY_DAYS_TARGET_MIN,
      targetMaxDays ?? DEFAULT_INVENTORY_DAYS_TARGET_MAX,
    ))
    : resolvedTrendDirection
      ? resolveTrendSentimentFromValues(
        currentValue ?? data[data.length - 1]?.value ?? null,
        previousValue ?? data[data.length - 2]?.value ?? null,
        resolvedTrendDirection,
      )
      : chartSentiment;
  const strokeColor = color ?? sentimentColor(resolvedSentiment);
  const glow = sentimentGlow(resolvedSentiment);
  const gradientId = `ccArea-${resolvedSentiment}-${debugLabel ?? 'chart'}`;

  const chartData = data.map((point) => ({
    snapshotKey: point.snapshotKey,
    snapshotDate: point.snapshotDate,
    snapshotDateLabel: formatChartDateLabel(point.snapshotDate || point.snapshotKey),
    snapshotDateFull: formatDateTime(point.snapshotKey || point.snapshotDate),
    value: point.value,
    [dataKey]: point.value,
  }));

  if (import.meta.env.DEV && debugLabel) {
    console.log(`[chart:${debugLabel}] rendered chart points:`, chartData.length);
    console.log(`[chart:${debugLabel}] chart data (1:1 with API trend):`, chartData.map((row) => ({
      snapshotDate: row.snapshotDate,
      snapshotKey: row.snapshotKey,
      value: row.value,
    })));
  }

  const xDataKey = snapshotXAxis ? 'snapshotKey' : 'snapshotDateLabel';
  const labelByKey = new Map(chartData.map((row) => [row.snapshotKey, row.snapshotDateLabel]));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            type="category"
            dataKey={xDataKey}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tickFormatter={snapshotXAxis ? (key) => labelByKey.get(String(key)) ?? String(key) : undefined}
          />
          <YAxis hide domain={sparklineDomain(chartData.map((row) => Number(row[dataKey])))} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as {
                snapshotDateFull?: string;
                snapshotDateLabel?: string;
                snapshotDate?: string;
              };
              const value = Number(payload[0].value);
              return (
                <ChartValueTooltip
                  label={row.snapshotDateFull ?? row.snapshotDate ?? row.snapshotDateLabel ?? '—'}
                  value={value}
                  valueKind={valueKind}
                  display={formatter(value)}
                />
              );
            }}
          />
          <Area
            type={curveType}
            dataKey={dataKey}
            stroke={strokeColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            style={{ filter: glow }}
            dot={showDots ? { r: 3, fill: strokeColor, strokeWidth: 0 } : false}
            activeDot={showDots ? { r: 5 } : undefined}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalRankBars({
  items,
  maxItems = 8,
}: {
  items: Array<{ name: string; value: number; contributionPct: number }>;
  maxItems?: number;
}) {
  const top = items.slice(0, maxItems);
  const max = top[0]?.value ?? 1;

  return (
    <div className="cc-rank-list">
      {top.map((item, index) => (
        <div key={item.name} className="cc-rank-row">
          <div className="cc-rank-meta">
            <span className={`cc-rank-badge ${index < 3 ? 'cc-rank-badge-top' : ''}`}>#{index + 1}</span>
            <span className="cc-rank-name">{item.name}</span>
          </div>
          <div className="cc-rank-bar-track">
            <div className="cc-rank-bar-fill" style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
          </div>
          <div className="cc-rank-value">
            <PrecisionValue value={item.value} kind="currency" />
            <PrecisionValue value={item.contributionPct} kind="percent" className="text-muted-theme" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutBreakdown({
  items,
  total,
}: {
  items: Array<{ name: string; value: number; color?: string }>;
  total: number;
}) {
  const palette = ['#f59e0b', '#2563eb', '#0f766e', '#7c3aed', '#db2777', '#64748b'];
  let offset = 0;
  const segments = items.slice(0, 6).map((item, index) => {
    const pct = total > 0 ? (item.value / total) * 100 : 0;
    const segment = { ...item, pct, offset, color: item.color ?? palette[index % palette.length] };
    offset += pct;
    return segment;
  });

  const gradient = segments.map((seg) => `${seg.color} ${seg.offset}% ${seg.offset + seg.pct}%`).join(', ');

  return (
    <div className="cc-donut-wrap">
      <div className="cc-donut" style={{ background: segments.length ? `conic-gradient(${gradient})` : 'var(--surface-muted)' }}>
        <div className="cc-donut-hole">
          <p className="text-xs text-muted-theme">Total</p>
          <PrecisionValue value={total} kind="currency" className="executive-numeral text-sm font-semibold text-primary-theme" />
        </div>
      </div>
      <div className="cc-donut-legend">
        {segments.map((seg) => (
          <div key={seg.name} className="cc-legend-item">
            <span className="cc-legend-dot" style={{ background: seg.color }} />
            <span className="cc-legend-label">{seg.name}</span>
            <PrecisionValue value={seg.pct} kind="percent" className="cc-legend-value" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PbtTrendPoint {
  monthLabel: string;
  revenue: number | null;
  directExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
}

export function PbtTrendChart({ data }: { data: PbtTrendPoint[] }) {
  if (data.length === 0) {
    return <div className="cc-chart-empty">Add monthly expense data to see trends</div>;
  }

  const chartData = data.map((point) => ({
    monthLabel: point.monthLabel,
    revenue: point.revenue ?? 0,
    directExpense: point.directExpense ?? 0,
    indirectExpense: point.indirectExpense ?? 0,
    profitBeforeTax: point.profitBeforeTax ?? 0,
  }));

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={sparklineDomain(chartData.flatMap((row) => [row.revenue, row.directExpense, row.indirectExpense, row.profitBeforeTax]))} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="sparkline-tooltip rounded-lg px-3 py-2 text-xs">
                  <p className="mb-1 font-medium text-primary-theme">{label}</p>
                  {payload.map((entry) => (
                    <p key={String(entry.dataKey)} className="text-secondary-theme">
                      {entry.name}: {formatCompactCurrency(Number(entry.value))}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="directExpense" name="Direct Expense" stroke="#dc2626" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="indirectExpense" name="Indirect Expense" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="profitBeforeTax" name="PBT" stroke="#0f766e" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
