import { useState } from 'react';
import type { CommandCenterResponse } from '../../types/command-center';
import PrecisionValue from '../ui/PrecisionValue';
import { TrendAreaChart } from './Charts';
import { formatExactDays } from '../../utils/command-center';

type InventoryDaysData = CommandCenterResponse['inventoryDays'];

function SummaryStat({
  label,
  value,
  kind,
}: {
  label: string;
  value: number | null;
  kind: 'currency' | 'days' | 'count';
}) {
  if (kind === 'days') {
    return (
      <div>
        <p className="cc-stat-label">{label}</p>
        <p className="cc-stat-value">{value === null ? '—' : formatExactDays(value)}</p>
      </div>
    );
  }
  if (kind === 'count') {
    return (
      <div>
        <p className="cc-stat-label">{label}</p>
        <p className="cc-stat-value">{value === null ? '—' : value.toLocaleString('en-IN')}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="cc-stat-label">{label}</p>
      <PrecisionValue value={value} kind="currency" className="cc-stat-value" block />
    </div>
  );
}

function DataSourcesPanel({ sources, methodology }: { sources: InventoryDaysData['dataSources']; methodology: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="cc-panel">
      <button
        type="button"
        className="cc-copq-sources-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="eyebrow">Data Sources & Methodology</p>
          <h3 className="cc-panel-title">How inventory days is calculated</h3>
        </div>
        <span className="text-sm font-semibold text-[var(--accent)]">{open ? 'Hide' : 'Expand'}</span>
      </button>
      {open ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-secondary-theme">{methodology}</p>
          <div className="cc-copq-sources-table-wrap overflow-x-auto">
            <table className="cc-pbt-table w-full text-sm">
              <thead>
                <tr>
                  <th>Data Source</th>
                  <th>Purpose</th>
                  <th>Refresh Date</th>
                  <th>File / Source</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.key}>
                    <td className="font-medium text-primary-theme">{source.name}</td>
                    <td className="text-secondary-theme">{source.purpose}</td>
                    <td>{new Date(source.refreshDate).toLocaleString('en-IN')}</td>
                    <td className="text-muted-theme">{source.fileName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function InventoryDaysIntelligenceModule({ inventoryDays }: { inventoryDays: InventoryDaysData }) {
  const { summary, formula, trend, insights } = inventoryDays;

  return (
    <div className="space-y-6">
      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Summary</p>
          <h3 className="cc-panel-title">Inventory days inputs and result</h3>
        </div>
        <div className="cc-profit-strip">
          <SummaryStat label="Current Inventory" value={summary.currentInventoryValue} kind="currency" />
          <SummaryStat label="YTD COGS" value={summary.ytdCogs} kind="currency" />
          <SummaryStat label="Days Elapsed" value={summary.daysElapsed} kind="count" />
          <SummaryStat label="Inventory Days" value={summary.inventoryDays} kind="days" />
        </div>
        <p className="mt-3 text-xs text-muted-theme">
          Snapshot {summary.snapshotDate} · Financial year from {summary.financialYearStart}
          {' · '}Target range {summary.targetMinDays}–{summary.targetMaxDays} days
        </p>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Calculation Transparency</p>
          <h3 className="cc-panel-title">Formula breakdown</h3>
        </div>
        {summary.statusMessage ? (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{summary.statusMessage}</p>
        ) : null}
        <div className="cc-copq-formula-block space-y-3 text-sm">
          <p className="font-mono text-primary-theme">{formula.expression}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs text-muted-theme">Inventory</p>
              <PrecisionValue value={formula.inventory} kind="currency" className="font-semibold" block />
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs text-muted-theme">Days Elapsed</p>
              <p className="font-semibold text-primary-theme">{formula.daysElapsed ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs text-muted-theme">YTD COGS</p>
              <PrecisionValue value={formula.ytdCogs} kind="currency" className="font-semibold" block />
            </div>
          </div>
          <p className="text-secondary-theme">
            Result:{' '}
            <span className="font-semibold text-primary-theme">
              {formula.inventoryDays !== null ? formatExactDays(formula.inventoryDays) : '—'}
            </span>
          </p>
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Trend</p>
          <h3 className="cc-panel-title">Inventory days over time</h3>
        </div>
        {trend.length > 0 ? (
          <>
            <p className="mb-3 text-xs text-muted-theme">
              {trend.length} snapshot{trend.length === 1 ? '' : 's'} plotted — one point per complete inventory snapshot batch.
            </p>
            <TrendAreaChart
              data={trend}
              trendDirection="target_range"
              currentValue={summary.inventoryDays}
              targetMinDays={summary.targetMinDays}
              targetMaxDays={summary.targetMaxDays}
              curveType="linear"
              showDots
              snapshotXAxis
              debugLabel="inventory-days"
              formatter={(value) => (value === null ? '—' : formatExactDays(value))}
            />
          </>
        ) : (
          <p className="text-sm text-muted-theme">Not enough snapshot history to plot inventory days.</p>
        )}
      </section>

      {insights.length > 0 ? (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <p className="eyebrow">Insights</p>
            <h3 className="cc-panel-title">Executive signals</h3>
          </div>
          <div className="cc-insights-list">
            {insights.map((insight) => (
              <div key={insight.id} className={`cc-insight cc-insight-${insight.severity}`}>
                <span className="cc-insight-dot" />
                <span>{insight.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <DataSourcesPanel sources={inventoryDays.dataSources} methodology={inventoryDays.methodology} />
    </div>
  );
}
