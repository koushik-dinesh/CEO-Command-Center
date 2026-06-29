import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { navHref } from '../config/navigation';
import type { RevenueDrilldownResponse, RevenueSalespersonRow } from '../types';
import { formatDate, formatDateTime, formatKpiValue } from '../utils/formatters';

type SortKey = 'rank' | 'salespersonName' | 'revenueAmount' | 'contributionPercent';
type SortDirection = 'asc' | 'desc';

interface RankedRevenueRow extends RevenueSalespersonRow {
  rank: number;
  revenue: number;
  contribution: number;
  revenueVsAverage: number;
  barLabel: string;
}

interface LeaderboardRowProps {
  row: RankedRevenueRow;
  maxRevenue: number;
}

function formatPercent(value: string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return `${numericValue.toFixed(2)}%`;
}

function formatCurrencyCompact(value: number): string {
  return formatKpiValue(String(value), 'currency');
}

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0);
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [durationMs, target]);

  return value;
}

function CountUpMetric({ value, format }: { value: number; format: (value: number) => string }) {
  const animatedValue = useCountUp(value);
  return <>{format(animatedValue)}</>;
}

function compareRows(
  a: RankedRevenueRow,
  b: RankedRevenueRow,
  sortKey: SortKey,
  sortDirection: SortDirection,
): number {
  const multiplier = sortDirection === 'asc' ? 1 : -1;
  if (sortKey === 'rank') return (a.rank - b.rank) * multiplier;
  if (sortKey === 'salespersonName') return a.salespersonName.localeCompare(b.salespersonName) * multiplier;
  if (sortKey === 'revenueAmount') return (a.revenue - b.revenue) * multiplier;
  return (a.contribution - b.contribution) * multiplier;
}

function rankTone(rank: number): string {
  if (rank === 1) return 'from-[#F59E0B] to-[#B45309] shadow-[0_8px_24px_rgba(180,83,9,0.22)]';
  if (rank === 2) return 'from-[#93C5FD] to-[#2563EB] shadow-[0_8px_24px_rgba(37,99,235,0.16)]';
  if (rank === 3) return 'from-[#2DD4BF] to-[#0F766E] shadow-[0_8px_24px_rgba(15,118,110,0.16)]';
  return 'from-[var(--chart-line)] to-[var(--accent-muted)] opacity-75';
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]';
  if (rank === 2) return 'border-[#BFDBFE] bg-[#DBEAFE] text-[#1D4ED8]';
  if (rank === 3) return 'border-[#99F6E4] bg-[#CCFBF1] text-[#0F766E]';
  return 'border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral)]';
}

function LeaderboardRow({ row, maxRevenue }: LeaderboardRowProps) {
  const percentage = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0;
  const contributionIsSmall = row.contribution < 3;
  const barWidth = Math.max(percentage, contributionIsSmall ? 8 : 4);
  const isLeader = row.rank <= 3;

  return (
    <div className={`group rounded-xl px-3 py-2 transition duration-200 hover:bg-[var(--surface-muted)] ${isLeader ? 'bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]' : ''}`}>
      <div className="grid items-center gap-3 md:grid-cols-[3rem_minmax(7rem,11rem)_1fr_6.5rem]">
        <div className={`inline-flex min-h-11 w-11 items-center justify-center rounded-full border text-xs font-black ${rankBadgeClass(row.rank)}`}>#{row.rank}</div>
        <div className="min-w-0">
          <p className={`truncate text-sm ${isLeader ? 'font-bold text-primary-theme' : 'font-semibold text-secondary-theme'}`}>{row.salespersonName}</p>
          <p className="text-[0.7rem] text-muted-theme">Avg {row.revenueVsAverage >= 0 ? '+' : ''}{formatCurrencyCompact(row.revenueVsAverage)}</p>
        </div>
        <div className="min-w-0">
          <div className="relative h-7 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className={`h-full rounded-full bg-gradient-to-r ${rankTone(row.rank)} transition-all duration-700 ease-out`} style={{ width: `${barWidth}%`, minWidth: contributionIsSmall ? 22 : 0 }} />
            {!contributionIsSmall ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-sm">{formatCurrencyCompact(row.revenue)}</span> : null}
          </div>
        </div>
        <div className="text-left md:text-right">
          {contributionIsSmall ? <p className="text-sm font-bold text-primary-theme">{formatCurrencyCompact(row.revenue)}</p> : <p className="hidden text-sm font-bold text-primary-theme md:block">{formatCurrencyCompact(row.revenue)}</p>}
          <p className="text-[0.7rem] text-muted-theme">{row.contribution.toFixed(2)}%</p>
        </div>
      </div>
      <div className="mt-2 md:hidden">
        <p className="text-sm font-bold text-primary-theme">{formatCurrencyCompact(row.revenue)}</p>
      </div>
    </div>
  );
}

export default function RevenueDrilldownPage() {
  const [searchParams] = useSearchParams();
  const snapshotKey = searchParams.get('snapshot') ?? undefined;
  const [data, setData] = useState<RevenueDrilldownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    api.revenueDrilldown()
      .then((result) => setData(result))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load Revenue drill-down'))
      .finally(() => setIsLoading(false));
  }, []);

  const rankedRows = useMemo<RankedRevenueRow[]>(() => {
    if (!data) return [];
    const average = Number(data.summary.averageRevenuePerSalesperson);
    return [...data.rows]
      .sort((a, b) => Number(b.revenueAmount) - Number(a.revenueAmount))
      .map((row, index) => {
        const revenue = Number(row.revenueAmount);
        const contribution = Number(row.contributionPercent);
        return {
          ...row,
          rank: index + 1,
          revenue,
          contribution,
          revenueVsAverage: revenue - average,
          barLabel: `${formatCurrencyCompact(revenue)} (${contribution.toFixed(0)}%)`,
        };
      });
  }, [data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rankedRows
      .filter((row) => !query || row.salespersonName.toLowerCase().includes(query))
      .sort((a, b) => compareRows(a, b, sortKey, sortDirection));
  }, [rankedRows, search, sortDirection, sortKey]);

  const chartRows = rankedRows;
  const maxRevenue = rankedRows[0]?.revenue ?? 0;
  const averageRevenue = Number(data?.summary.averageRevenuePerSalesperson ?? 0);
  const topContributor = rankedRows[0] ?? null;
  const secondContributor = rankedRows[1] ?? null;
  const revenueGapToSecond = topContributor && secondContributor ? topContributor.revenue - secondContributor.revenue : 0;
  const topThreeContribution = rankedRows.slice(0, 3).reduce((total, row) => total + row.contribution, 0);
  const bottomThreeContribution = rankedRows.slice(-3).reduce((total, row) => total + row.contribution, 0);
  const concentrationRisk = topThreeContribution >= 70 ? 'high' : topThreeContribution >= 50 ? 'moderate' : 'balanced';
  const topFourContribution = rankedRows.slice(0, 4).reduce((total, row) => total + row.contribution, 0);
  const insights = [
    `Top 4 salespersons generate ${topFourContribution.toFixed(1)}% of revenue.`,
    topContributor && secondContributor ? `${topContributor.salespersonName} leads by ${formatCurrencyCompact(revenueGapToSecond)}.` : 'A second contributor is not available for comparison.',
    `Bottom 3 contributors account for ${bottomThreeContribution < 1 ? '<1' : bottomThreeContribution.toFixed(1)}% of revenue.`,
    `Revenue concentration risk is ${concentrationRisk}.`,
  ];

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'salespersonName' ? 'asc' : nextKey === 'rank' ? 'asc' : 'desc');
  }

  function exportCsv() {
    const headers = ['Rank', 'Salesperson Name', 'Salesperson Code', 'Revenue Amount', 'Contribution Percent'];
    const csv = [
      headers.join(','),
      ...rankedRows.map((row) => [
        row.rank,
        row.salespersonName,
        row.salespersonCode ?? '',
        row.revenueAmount,
        row.contributionPercent,
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-by-salesperson-${data?.sourceFile.fileDate ?? 'latest'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPng() {
    const scale = 2;
    const width = 1400;
    const rowHeight = 58;
    const headerHeight = 178;
    const footerHeight = 44;
    const rowsToExport = chartRows;
    const height = headerHeight + rowsToExport.length * rowHeight + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111827';
    context.font = '700 34px Inter, Arial, sans-serif';
    context.fillText('Revenue Leaderboard', 48, 56);
    context.fillStyle = '#4B5563';
    context.font = '500 18px Inter, Arial, sans-serif';
    context.fillText(`Source: ${data?.sourceFile.name ?? 'latest file'}`, 48, 88);

    [
      ['Top Contributor', topContributor?.salespersonName ?? 'Unavailable'],
      ['Gap to #2', secondContributor ? formatCurrencyCompact(revenueGapToSecond) : 'Unavailable'],
      ['Avg Rev', formatCurrencyCompact(averageRevenue)],
    ].forEach(([label, value], index) => {
      const x = 48 + index * 300;
      context.fillStyle = '#6B7280';
      context.font = '600 13px Inter, Arial, sans-serif';
      context.fillText(label.toUpperCase(), x, 126);
      context.fillStyle = '#111827';
      context.font = '700 24px Inter, Arial, sans-serif';
      context.fillText(value, x, 158);
    });

    const max = maxRevenue || 1;
    rowsToExport.forEach((row, index) => {
      const y = headerHeight + index * rowHeight;
      const barX = 240;
      const barY = y + 17;
      const barWidth = 820;
      const fillWidth = Math.max((row.revenue / max) * barWidth, row.contribution < 3 ? 28 : 8);
      context.fillStyle = row.rank === 1 ? '#B45309' : row.rank === 2 ? '#2563EB' : row.rank === 3 ? '#0F766E' : '#64748B';
      context.fillRect(barX, barY, fillWidth, 18);
      context.fillStyle = '#111827';
      context.font = row.rank <= 3 ? '700 17px Inter, Arial, sans-serif' : '600 16px Inter, Arial, sans-serif';
      context.fillText(`#${row.rank}`, 48, y + 32);
      context.fillText(row.salespersonName, 100, y + 32);
      context.textAlign = 'right';
      context.fillText(formatCurrencyCompact(row.revenue), 1300, y + 32);
      context.textAlign = 'left';
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `revenue-leaderboard-${data?.sourceFile.fileDate ?? 'latest'}.png`;
    link.click();
  }

  return (
    <>
      <div className="dashboard-panel mb-8 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="eyebrow text-sm font-semibold uppercase tracking-[0.25em]">Revenue Drill-Down</p>
            <h2 className="mt-2 text-xl font-semibold text-primary-theme">Salesperson Revenue Breakdown</h2>
            <p className="mt-1 text-sm text-secondary-theme">Latest Salesperson revenue file from Google Drive.</p>
          </div>
          <Link to={navHref('/', snapshotKey)} className="piano-button-secondary px-4 py-3 text-sm font-semibold">
            Command Center
          </Link>
        </div>
      </div>

      {isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-[var(--surface-muted)]" /> : null}
      {error ? <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p> : null}

      {data ? (
        <div className="space-y-6">
          <section className="dashboard-panel p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-theme">Source file</p>
                <h3 className="mt-2 break-all text-lg font-semibold text-primary-theme">{data.sourceFile.name}</h3>
                <p className="mt-1 text-sm text-secondary-theme">File date: {formatDate(data.sourceFile.fileDate)}</p>
                <p className="mt-1 text-sm text-secondary-theme">Last updated: {formatDateTime(data.sourceFile.modifiedTime)}</p>
              </div>
              <div className="metadata-panel rounded-xl p-4 text-sm">
                <p className="text-muted-theme">Highest contributor</p>
                <p className="mt-1 text-lg font-semibold text-primary-theme">{data.summary.highestRevenueContributor?.salespersonName ?? 'Unavailable'}</p>
                <p className="mt-1 text-secondary-theme">{formatKpiValue(data.summary.highestRevenueContributor?.revenueAmount ?? null, 'currency')}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="kpi-card p-5"><p className="text-sm text-muted-theme">Total Revenue</p><p className="mt-2 text-2xl font-semibold text-primary-theme"><CountUpMetric value={Number(data.summary.totalRevenue)} format={formatCurrencyCompact} /></p></div>
            <div className="kpi-card p-5"><p className="text-sm text-muted-theme">Salespersons</p><p className="mt-2 text-2xl font-semibold text-primary-theme"><CountUpMetric value={data.summary.salespersonCount} format={(value) => Math.round(value).toString()} /></p></div>
            <div className="kpi-card p-5"><p className="text-sm text-muted-theme">Average Revenue</p><p className="mt-2 text-2xl font-semibold text-primary-theme"><CountUpMetric value={Number(data.summary.averageRevenuePerSalesperson)} format={formatCurrencyCompact} /></p></div>
            <div className="kpi-card p-5"><p className="text-sm text-muted-theme">Top Contribution</p><p className="mt-2 text-2xl font-semibold text-primary-theme"><CountUpMetric value={Number(data.summary.highestRevenueContributor?.contributionPercent ?? '0')} format={(value) => `${value.toFixed(2)}%`} /></p></div>
          </section>

          <section className="dashboard-panel overflow-hidden p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-theme">Revenue Distribution</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-primary-theme md:text-2xl">Revenue Leaderboard</h3>
                <p className="mt-1 text-sm text-secondary-theme">All salespersons ranked by YTD revenue contribution.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportPng} className="piano-button-secondary min-h-11 px-3 py-2 text-xs font-semibold">Export PNG</button>
                <button type="button" onClick={exportCsv} className="piano-button-secondary min-h-11 px-3 py-2 text-xs font-semibold">Export CSV</button>
              </div>
            </div>

            <div className="metadata-panel mt-5 grid gap-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] md:grid-cols-3">
              <div className="border-b border-[var(--border-subtle)] p-4 md:border-b-0 md:border-r">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-theme">Top Contributor</p>
                <p className="mt-2 text-lg font-semibold text-primary-theme">{topContributor?.salespersonName ?? 'Unavailable'}</p>
              </div>
              <div className="border-b border-[var(--border-subtle)] p-4 md:border-b-0 md:border-r">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-theme">Gap to #2</p>
                <p className="mt-2 text-lg font-semibold text-primary-theme">{secondContributor ? <CountUpMetric value={revenueGapToSecond} format={formatCurrencyCompact} /> : 'Unavailable'}</p>
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-theme">Avg Rev</p>
                <p className="mt-2 text-lg font-semibold text-primary-theme"><CountUpMetric value={averageRevenue} format={formatCurrencyCompact} /></p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-theme">
              <span>Showing all {rankedRows.length} salespersons ranked by revenue</span>
              <span>{topContributor ? `${topContributor.salespersonName} contribution ${topContributor.contribution.toFixed(1)}%` : ''}</span>
            </div>

            <div className="mt-3 space-y-1.5">
              {chartRows.map((row) => <LeaderboardRow key={row.salespersonCode ?? row.salespersonName} row={row} maxRevenue={maxRevenue} />)}
            </div>

            <div className="metadata-panel mt-6 rounded-2xl p-5">
              <h4 className="text-base font-semibold text-primary-theme">Insights</h4>
              <ul className="mt-3 space-y-2 text-sm text-secondary-theme">
                {insights.map((insight) => <li key={insight}>• {insight}</li>)}
              </ul>
            </div>
          </section>

          <section className="dashboard-panel p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-semibold text-primary-theme">Full Salesperson Ranking</h3>
                <p className="mt-1 text-sm text-secondary-theme">Search and sort every salesperson by rank, revenue, or contribution.</p>
              </div>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-primary-theme outline-none transition focus:border-[var(--accent-muted)] md:w-72" placeholder="Search salesperson" />
            </div>
            <div className="premium-scrollbar mt-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-muted-theme">
                  <tr>
                    <th className="px-4 py-3"><button type="button" onClick={() => toggleSort('rank')}>Rank</button></th>
                    <th className="px-4 py-3"><button type="button" onClick={() => toggleSort('salespersonName')}>Salesperson Name</button></th>
                    <th className="px-4 py-3"><button type="button" onClick={() => toggleSort('revenueAmount')}>Revenue Amount</button></th>
                    <th className="px-4 py-3"><button type="button" onClick={() => toggleSort('contributionPercent')}>% Contribution</button></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.salespersonCode ?? row.salespersonName}-${row.salespersonName}`} className="border-t border-[var(--border-subtle)] text-secondary-theme">
                      <td className="px-4 py-3 font-semibold text-primary-theme">#{row.rank}</td>
                      <td className="px-4 py-3 font-medium text-primary-theme">{row.salespersonName}</td>
                      <td className="px-4 py-3">{formatKpiValue(row.revenueAmount, 'currency')}</td>
                      <td className="px-4 py-3">{formatPercent(row.contributionPercent)}</td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-theme">No salesperson matches your search.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
