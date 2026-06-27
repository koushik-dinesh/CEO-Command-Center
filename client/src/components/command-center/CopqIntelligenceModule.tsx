import { useMemo, type ReactNode } from 'react';
import type { CommandCenterResponse } from '../../types/command-center';
import PrecisionValue from '../ui/PrecisionValue';
import { TrendAreaChart } from './Charts';
import { formatPercent } from '../../utils/command-center';

type CopqData = CommandCenterResponse['copq'];

function SummaryStat({ label, value, kind }: { label: string; value: number | null; kind: 'currency' }) {
  return (
    <div className="cc-kpi-card">
      <p className="cc-stat-label">{label}</p>
      <PrecisionValue value={value} kind={kind} className="cc-stat-value" block />
    </div>
  );
}

function InsightCards({ insights }: { insights: CopqData['insights'] }) {
  if (insights.length === 0) return null;
  return (
    <div className="cc-insights-list">
      {insights.map((insight) => (
        <div key={insight.id} className={`cc-insight cc-insight-${insight.severity}`}>
          <span className="cc-insight-dot" />
          <span>{insight.message}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsTable({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="cc-panel-title">{title}</h3>
      </div>
      <div className="cc-pbt-table-wrap overflow-x-auto">{children}</div>
    </section>
  );
}

export default function CopqIntelligenceModule({ copq }: { copq: CopqData }) {
  const monthlyChartData = useMemo(
    () => copq.monthlyTrend.map((row) => ({
      snapshotKey: row.month,
      snapshotDate: row.month,
      value: row.copq,
    })),
    [copq.monthlyTrend],
  );

  return (
    <div className="space-y-6">
      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">KPI Summary</p>
          <h3 className="cc-panel-title">Why is total COPQ what it is?</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryStat label="Total COPQ (YTD)" value={copq.summary.totalCopqYtd} kind="currency" />
          <SummaryStat label="COPQ MTD" value={copq.summary.copqMtd} kind="currency" />
          <SummaryStat label="COPQ QTD" value={copq.summary.copqQtd} kind="currency" />
          <SummaryStat label="QA Saved Amount" value={copq.summary.qaSavedAmount} kind="currency" />
          <SummaryStat label="COPQ Before QA Clearance" value={copq.summary.beforeQaClearance} kind="currency" />
        </div>
      </section>

      {copq.insights.length > 0 ? (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <p className="eyebrow">Key Takeaways</p>
            <h3 className="cc-panel-title">What stands out in the COPQ profile</h3>
          </div>
          <InsightCards insights={copq.insights} />
        </section>
      ) : null}

      <AnalyticsTable title="COPQ breakdown by category" eyebrow="Category Analysis">
        <table className="cc-pbt-table w-full text-sm">
          <thead>
            <tr>
              <th>Category</th>
              <th>MTD</th>
              <th>QTD</th>
              <th>YTD</th>
              <th>% of Total COPQ</th>
            </tr>
          </thead>
          <tbody>
            {copq.categoryBreakdown.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-theme">No category data available.</td>
              </tr>
            ) : copq.categoryBreakdown.map((row) => (
              <tr key={row.category}>
                <td className="font-medium text-primary-theme">{row.category}</td>
                <td><PrecisionValue value={row.mtd} kind="currency" /></td>
                <td><PrecisionValue value={row.qtd} kind="currency" /></td>
                <td><PrecisionValue value={row.ytd} kind="currency" /></td>
                <td>{formatPercent(row.pctOfTotal, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AnalyticsTable>

      <AnalyticsTable title="Top COPQ contributors" eyebrow="Highest Impact NCs">
        <table className="cc-pbt-table w-full text-sm">
          <thead>
            <tr>
              <th>NC Number</th>
              <th>Date</th>
              <th>Product</th>
              <th>Department</th>
              <th>Root Cause</th>
              <th>Final COPQ</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {copq.topContributors.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-theme">No NC contributor data available.</td>
              </tr>
            ) : copq.topContributors.map((row) => (
              <tr key={`${row.ncNumber}-${row.date}-${row.finalCopq}`}>
                <td className="font-medium text-primary-theme">{row.ncNumber}</td>
                <td>{row.date}</td>
                <td>{row.product}</td>
                <td>{row.department}</td>
                <td>{row.rootCause}</td>
                <td><PrecisionValue value={row.finalCopq} kind="currency" /></td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AnalyticsTable>

      <AnalyticsTable title="Department-wise COPQ" eyebrow="Department View">
        <table className="cc-pbt-table w-full text-sm">
          <thead>
            <tr>
              <th>Department</th>
              <th>Number of NCs</th>
              <th>Total COPQ</th>
              <th>Average COPQ</th>
              <th>% Contribution</th>
            </tr>
          </thead>
          <tbody>
            {copq.byDepartment.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-theme">No department data available.</td>
              </tr>
            ) : copq.byDepartment.map((row) => (
              <tr key={row.department}>
                <td className="font-medium text-primary-theme">{row.department}</td>
                <td>{row.ncCount.toLocaleString('en-IN')}</td>
                <td><PrecisionValue value={row.totalCopq} kind="currency" /></td>
                <td><PrecisionValue value={row.avgCopq} kind="currency" /></td>
                <td>{formatPercent(row.pctContribution, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AnalyticsTable>

      <AnalyticsTable title="Product-wise COPQ" eyebrow="Product View">
        <table className="cc-pbt-table w-full text-sm">
          <thead>
            <tr>
              <th>Product</th>
              <th>NC Count</th>
              <th>Total COPQ</th>
            </tr>
          </thead>
          <tbody>
            {copq.byProduct.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-muted-theme">No product data available.</td>
              </tr>
            ) : copq.byProduct.map((row) => (
              <tr key={row.product}>
                <td className="font-medium text-primary-theme">{row.product}</td>
                <td>{row.ncCount.toLocaleString('en-IN')}</td>
                <td><PrecisionValue value={row.totalCopq} kind="currency" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </AnalyticsTable>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Monthly Trend</p>
          <h3 className="cc-panel-title">COPQ movement over time</h3>
        </div>
        {monthlyChartData.length >= 2 ? (
          <div className="mb-5">
            <TrendAreaChart data={monthlyChartData} trendDirection="lower_is_better" />
          </div>
        ) : null}
        <div className="cc-pbt-table-wrap overflow-x-auto">
          <table className="cc-pbt-table w-full text-sm">
            <thead>
              <tr>
                <th>Month</th>
                <th>COPQ</th>
                <th>QA Saved</th>
                <th>Before QA Clearance</th>
              </tr>
            </thead>
            <tbody>
              {copq.monthlyTrend.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-theme">No monthly trend data available.</td>
                </tr>
              ) : copq.monthlyTrend.map((row) => (
                <tr key={row.month}>
                  <td className="font-medium text-primary-theme">{row.monthLabel}</td>
                  <td><PrecisionValue value={row.copq} kind="currency" /></td>
                  <td><PrecisionValue value={row.qaSaved} kind="currency" /></td>
                  <td><PrecisionValue value={row.beforeQaClearance} kind="currency" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Source Information</p>
          <h3 className="cc-panel-title">Data provenance</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs text-muted-theme">Source Workbook</p>
            <p className="mt-1 font-semibold text-primary-theme">{copq.sourceInfo.sourceWorkbook ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs text-muted-theme">Sheet Name</p>
            <p className="mt-1 font-semibold text-primary-theme">{copq.sourceInfo.sheetName ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs text-muted-theme">Last Updated</p>
            <p className="mt-1 font-semibold text-primary-theme">
              {copq.sourceInfo.lastUpdated ? new Date(copq.sourceInfo.lastUpdated).toLocaleString('en-IN') : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs text-muted-theme">Refresh Time</p>
            <p className="mt-1 font-semibold text-primary-theme">
              {copq.sourceInfo.refreshTime ? new Date(copq.sourceInfo.refreshTime).toLocaleString('en-IN') : '—'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
