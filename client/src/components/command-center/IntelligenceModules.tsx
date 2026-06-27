import { useMemo, useState } from 'react';
import type { CommandCenterResponse } from '../../types/command-center';
import { formatPercent, formatSignedPercentDisplay } from '../../utils/command-center';
import { formatCurrencyDisplay } from '../../utils/currencyInput';
import PrecisionValue from '../ui/PrecisionValue';
import { HorizontalRankBars, TrendAreaChart, DonutBreakdown, PbtTrendChart } from './Charts';

function CustomerGroupIntelligence({ groups }: { groups: CommandCenterResponse['revenue']['customerGroupInsights'] }) {
  if (groups.length === 0) return null;

  return (
    <div className="cc-module-card cc-module-wide">
      <p className="cc-module-label">Customer Group Intelligence</p>
      <div className="cc-cg-grid">
        {groups.map((group) => (
          <article key={group.name} className="cc-cg-card">
            <p className="cc-cg-eyebrow">{group.name} Revenue</p>
            <PrecisionValue value={group.value} kind="currency" className="cc-cg-revenue executive-numeral" block />
            <dl className="cc-cg-metrics">
              <div className="cc-cg-metric">
                <dt>Contribution to Total Revenue</dt>
                <dd><PrecisionValue value={group.contributionPct} kind="percent" /></dd>
              </div>
              <div className="cc-cg-metric">
                <dt>Rank</dt>
                <dd>#{group.rank} of {group.totalGroups}</dd>
              </div>
              <div className="cc-cg-metric">
                <dt>Growth vs Previous Snapshot</dt>
                <dd className={group.growthPct !== null && group.growthPct >= 0 ? 'cc-cg-growth-up' : 'cc-cg-growth-down'}>
                  <PrecisionValue
                    value={group.growthPct}
                    kind="percent"
                    signed
                    display={group.growthPct !== null ? formatSignedPercentDisplay(group.growthPct) : '—'}
                  />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

function StatValue({ label, value, kind }: { label: string; value: number | null; kind: 'currency' | 'percent' }) {
  return (
    <div>
      <p className="cc-stat-label">{label}</p>
      <PrecisionValue value={value} kind={kind} className="cc-stat-value" block />
    </div>
  );
}

export function RevenueModule({ revenue }: { revenue: CommandCenterResponse['revenue'] }) {
  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Revenue Intelligence</p>
        <h3 className="cc-panel-title">Performance, contribution, and growth</h3>
      </div>
      <div className="cc-module-grid">
        <div className="cc-module-card cc-module-wide">
          <p className="cc-module-label">Revenue Trend</p>
          <TrendAreaChart data={revenue.trend} trendDirection="higher_is_better" />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Top Salespersons</p>
          <HorizontalRankBars items={revenue.bySalesperson} maxItems={6} />
        </div>
        <CustomerGroupIntelligence groups={revenue.customerGroupInsights} />
        <div className="cc-module-card">
          <p className="cc-module-label">Product Group Leaders</p>
          <HorizontalRankBars items={revenue.byProductGroup} maxItems={6} />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Top Performers</p>
          <div className="cc-top-strip">
            {revenue.topPerformers.map((performer) => (
              <div key={performer.name} className="cc-top-card">
                <p className="text-xs text-muted-theme">#{performer.rank}</p>
                <p className="font-semibold text-primary-theme">{performer.name}</p>
                <PrecisionValue value={performer.value} kind="currency" className="executive-numeral text-sm" block />
                <p className="text-xs text-secondary-theme">
                  <PrecisionValue value={performer.contributionPct} kind="percent" /> share
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProfitabilityModule({ profitability }: { profitability: CommandCenterResponse['profitability'] }) {
  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Revenue vs COGS</p>
        <h3 className="cc-panel-title">Profitability and margin intelligence</h3>
      </div>
      <div className="cc-profit-strip">
        <StatValue label="Revenue" value={profitability.revenue} kind="currency" />
        <StatValue label="COGS" value={profitability.cogs} kind="currency" />
        <StatValue label="Gross Profit" value={profitability.grossProfit} kind="currency" />
        <StatValue label="Gross Margin" value={profitability.grossMarginPct} kind="percent" />
      </div>
      <div className="cc-module-grid">
        <div className="cc-module-card cc-module-wide">
          <p className="cc-module-label">Margin Trend</p>
          <TrendAreaChart
            data={profitability.marginTrend}
            formatter={(v) => formatPercent(v, 1)}
            valueKind="percent"
            color="var(--accent-muted)"
          />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Category Performance</p>
          <div className="cc-category-list">
            {profitability.byCategory.map((row) => (
              <div key={row.type} className="cc-category-row">
                <div>
                  <p className="font-medium text-primary-theme">{row.type}</p>
                  <p className="text-xs text-muted-theme">
                    <PrecisionValue value={row.revenue} kind="currency" /> revenue
                  </p>
                </div>
                <PrecisionValue value={row.marginPct} kind="percent" className="executive-numeral text-sm font-semibold" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function InventoryModule({ inventory }: { inventory: CommandCenterResponse['inventory'] }) {
  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Inventory Intelligence</p>
        <h3 className="cc-panel-title">Warehouse distribution and concentration</h3>
      </div>
      <div className="cc-profit-strip">
        <StatValue label="Total Inventory" value={inventory.totalValue} kind="currency" />
        <div>
          <p className="cc-stat-label">Top Warehouse</p>
          <p className="cc-stat-value">{inventory.concentration.topWarehouse}</p>
        </div>
        <StatValue label="Concentration" value={inventory.concentration.topSharePct} kind="percent" />
      </div>
      <div className="cc-module-grid">
        <div className="cc-module-card cc-module-wide">
          <p className="cc-module-label">Inventory Trend</p>
          <TrendAreaChart data={inventory.trend} trendDirection="lower_is_better" />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Warehouse Distribution</p>
          <DonutBreakdown
            items={inventory.byWarehouse.slice(0, 6).map((row) => ({ name: row.name, value: row.value }))}
            total={inventory.totalValue}
          />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Warehouse Rankings</p>
          <HorizontalRankBars
            items={inventory.byWarehouse.map((row) => ({ name: row.name, value: row.value, contributionPct: row.contributionPct }))}
            maxItems={8}
          />
        </div>
      </div>
    </section>
  );
}

export function DeadStockModule({ deadStock }: { deadStock: CommandCenterResponse['deadStock'] }) {
  const trendData = deadStock.trend.map((point) => ({
    snapshotKey: point.snapshotKey,
    snapshotDate: point.snapshotDate,
    value: point.dead + point.slow,
  }));

  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Dead & Slow Moving Stock</p>
        <h3 className="cc-panel-title">Risk inventory and aging analysis</h3>
      </div>
      <div className="cc-profit-strip">
        <StatValue label="Dead Stock" value={deadStock.deadStockValue} kind="currency" />
        <StatValue label="Slow Moving" value={deadStock.slowMovingValue} kind="currency" />
        <StatValue label="Problem Stock %" value={deadStock.problemPct} kind="percent" />
      </div>
      <div className="cc-module-grid">
        <div className="cc-module-card cc-module-wide">
          <p className="cc-module-label">Problem Stock Trend</p>
          <TrendAreaChart data={trendData} trendDirection="lower_is_better" />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Aging Distribution</p>
          <div className="cc-aging-list">
            {deadStock.agingBuckets.map((bucket) => (
              <div key={bucket.label} className="cc-aging-row">
                <span>{bucket.label}</span>
                <PrecisionValue value={bucket.value} kind="currency" className="executive-numeral" />
                <span className="text-muted-theme">{bucket.count} items</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Top Problem Inventory</p>
          <div className="cc-problem-list">
            {deadStock.topProblemItems.map((item) => (
              <div key={item.itemNo} className="cc-problem-row">
                <div>
                  <p className="font-medium text-primary-theme">{item.itemNo}</p>
                  <p className="text-xs text-secondary-theme line-clamp-1">{item.description}</p>
                </div>
                <div className="text-right">
                  <PrecisionValue value={item.value} kind="currency" className="executive-numeral text-sm" block />
                  <p className="text-xs text-muted-theme">{item.status} · {item.daysIdle}d</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PbtInsightCards({ insights }: { insights: CommandCenterResponse['pbt']['insights'] }) {
  if (insights.length === 0) return null;
  return (
    <div className="cc-module-card cc-module-wide">
      <p className="cc-module-label">Business Insights</p>
      <div className="cc-insights-list">
        {insights.map((insight) => (
          <div key={insight.id} className={`cc-insight cc-insight-${insight.severity}`}>
            <span className="cc-insight-dot" />
            <span>{insight.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type PbtSortKey = 'monthLabel' | 'revenue' | 'directExpense' | 'indirectExpense' | 'profitBeforeTax';

export function PbtModule({ pbt }: { pbt: CommandCenterResponse['pbt'] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<PbtSortKey>('monthLabel');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = [...pbt.records];
    if (query) {
      rows = rows.filter((row) => row.monthLabel.toLowerCase().includes(query));
    }
    rows.sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'monthLabel') {
        const aKey = a.year * 100 + a.month;
        const bKey = b.year * 100 + b.month;
        return (aKey - bKey) * mult;
      }
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (Number(av) - Number(bv)) * mult;
    });
    return rows;
  }, [pbt.records, search, sortKey, sortDir]);

  function toggleSort(key: PbtSortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function exportCsv() {
    const header = ['Month', 'Revenue', 'Direct Expense', 'Indirect Expense', 'PBT'];
    const lines = filteredRecords.map((row) => [
      row.monthLabel,
      row.revenue ?? '',
      row.directExpense ?? '',
      row.indirectExpense ?? '',
      row.profitBeforeTax ?? '',
    ].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'profit-before-tax-history.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Profit Before Tax</p>
        <h3 className="cc-panel-title">PBT intelligence and trend analysis</h3>
      </div>
      <div className="cc-profit-strip">
        <StatValue label="Revenue" value={pbt.revenue} kind="currency" />
        <StatValue label="Direct Expense" value={pbt.directExpense} kind="currency" />
        <StatValue label="Indirect Expense" value={pbt.indirectExpense} kind="currency" />
        <StatValue label="Profit Before Tax" value={pbt.profitBeforeTax} kind="currency" />
      </div>

      <div className="cc-pbt-formula mb-6">
        <div className="cc-pbt-formula-step">
          <p className="cc-pbt-formula-label">Revenue</p>
          <PrecisionValue value={pbt.revenue} kind="currency" className="cc-pbt-formula-value executive-numeral" block />
        </div>
        <span className="cc-pbt-formula-op">minus</span>
        <div className="cc-pbt-formula-step">
          <p className="cc-pbt-formula-label">Direct Expense</p>
          <PrecisionValue value={pbt.directExpense} kind="currency" className="cc-pbt-formula-value executive-numeral" block />
        </div>
        <span className="cc-pbt-formula-op">minus</span>
        <div className="cc-pbt-formula-step">
          <p className="cc-pbt-formula-label">Indirect Expense</p>
          <PrecisionValue value={pbt.indirectExpense} kind="currency" className="cc-pbt-formula-value executive-numeral" block />
          <p className="mt-1 text-xs text-muted-theme">
            HR {pbt.hrExpense !== null ? formatCurrencyDisplay(pbt.hrExpense) : '—'}
            {' + Additional '}
            {pbt.additionalIndirectExpense !== null ? formatCurrencyDisplay(pbt.additionalIndirectExpense) : '—'}
          </p>
        </div>
        <span className="cc-pbt-formula-op">equals</span>
        <div className="cc-pbt-formula-step cc-pbt-formula-result">
          <p className="cc-pbt-formula-label">Profit Before Tax</p>
          <PrecisionValue value={pbt.profitBeforeTax} kind="currency" className="cc-pbt-formula-value executive-numeral" block />
        </div>
      </div>

      <div className="cc-module-grid">
        <div className="cc-module-card cc-module-wide">
          <p className="cc-module-label">Trend Analysis</p>
          <PbtTrendChart data={pbt.trend} />
        </div>
        <PbtInsightCards insights={pbt.insights} />
        <div className="cc-module-card cc-module-wide">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="cc-module-label mb-0">Historical Records</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-primary-theme outline-none focus:border-[var(--accent-muted)]"
                placeholder="Search month…"
              />
              <button type="button" className="piano-button-secondary rounded-xl px-4 py-2 text-xs font-semibold" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
          </div>
          <div className="cc-pbt-table-wrap overflow-x-auto">
            <table className="cc-pbt-table w-full text-sm">
              <thead>
                <tr>
                  {([
                    ['monthLabel', 'Month'],
                    ['revenue', 'Revenue'],
                    ['directExpense', 'Direct Expense'],
                    ['indirectExpense', 'Indirect Expense'],
                    ['profitBeforeTax', 'PBT'],
                  ] as const).map(([key, label]) => (
                    <th key={key}>
                      <button type="button" className="cc-pbt-sort-btn" onClick={() => toggleSort(key)}>
                        {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-theme">No records match your search.</td>
                  </tr>
                ) : filteredRecords.map((row) => (
                  <tr key={`${row.year}-${row.month}`}>
                    <td className="font-medium text-primary-theme">{row.monthLabel}</td>
                    <td><PrecisionValue value={row.revenue} kind="currency" /></td>
                    <td><PrecisionValue value={row.directExpense} kind="currency" /></td>
                    <td><PrecisionValue value={row.indirectExpense} kind="currency" /></td>
                    <td><PrecisionValue value={row.profitBeforeTax} kind="currency" className="font-semibold" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
