import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HrExpenseRecord, ProductivityIntelligence } from '../../types/productivity';
import type { MetricTrendPoint } from '../../types/command-center';
import { api } from '../../services/api';
import { useCommandCenterContext } from '../../context/CommandCenterContext';
import PrecisionValue from '../ui/PrecisionValue';
import { TrendAreaChart } from './Charts';
import IndianRupeeIntegerInput from '../ui/IndianRupeeIntegerInput';
import { formatCompactRatio, formatExactRatio } from '../../utils/command-center';
import { formatCurrencyDisplay } from '../../utils/currencyInput';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

type ToastState = { message: string; kind: 'success' | 'error' };

function SummaryStat({
  label,
  value,
  kind,
}: {
  label: string;
  value: number | null;
  kind: 'currency' | 'ratio';
}) {
  if (kind === 'ratio') {
    return (
      <div>
        <p className="cc-stat-label">{label}</p>
        <p className="cc-stat-value">{value === null ? '—' : formatExactRatio(value)}</p>
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

const inputClass = 'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-primary-theme outline-none focus:border-[var(--accent-muted)]';
const rupeeInputClass = `${inputClass} pl-8`;

export default function ProductivityIntelligenceModule({ productivity }: { productivity: ProductivityIntelligence }) {
  const { reload } = useCommandCenterContext();
  const { summary, trend, dataSources, insights, hrExpenses } = productivity;

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - 3 + index);
  }, []);

  const existingForSelection = useMemo(
    () => hrExpenses.find((record) => record.month === selectedMonth && record.calendarYear === selectedYear) ?? null,
    [hrExpenses, selectedMonth, selectedYear],
  );

  useEffect(() => {
    setAmount(existingForSelection?.hrExpense ?? null);
  }, [existingForSelection]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const chartData: MetricTrendPoint[] = trend
    .filter((point) => point.productivityIndex !== null)
    .map((point) => ({
      snapshotKey: `${point.calendarYear}${String(point.month).padStart(2, '0')}`,
      snapshotDate: `${point.calendarYear}-${String(point.month).padStart(2, '0')}-01`,
      value: point.productivityIndex!,
    }));

  const refreshDashboard = useCallback(async () => {
    await reload(undefined, { silent: true });
  }, [reload]);

  async function handleSave() {
    if (amount === null || amount <= 0) {
      setToast({ message: 'HR expense must be a number greater than zero.', kind: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await api.productivitySaveHrExpense({
        month: selectedMonth,
        year: selectedYear,
        hrExpense: amount,
      });
      setToast({
        message: existingForSelection ? 'HR expense updated.' : 'HR expense saved.',
        kind: 'success',
      });
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      setToast({ message, kind: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: HrExpenseRecord) {
    const key = record.id;
    setDeletingKey(key);
    try {
      await api.productivityDeleteHrExpense(record.calendarYear, record.month);
      setToast({ message: 'HR expense deleted.', kind: 'success' });
      if (record.month === selectedMonth && record.calendarYear === selectedYear) {
        setAmount(null);
      }
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      setToast({ message, kind: 'error' });
    } finally {
      setDeletingKey(null);
    }
  }

  function loadRecordIntoForm(record: HrExpenseRecord) {
    setSelectedMonth(record.month);
    setSelectedYear(record.calendarYear);
    setAmount(record.hrExpense);
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className={`rounded-xl px-4 py-3 text-sm ${toast.kind === 'success' ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'error-banner'}`}>
          {toast.message}
        </div>
      ) : null}

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">KPI Summary</p>
          <h3 className="cc-panel-title">Productivity Index inputs and result</h3>
        </div>
        <div className="cc-profit-strip">
          <SummaryStat label="Productivity Index (YTD)" value={summary.productivityIndex} kind="ratio" />
          <SummaryStat label="Revenue (YTD)" value={summary.revenueYtd} kind="currency" />
          <SummaryStat label="HR Expense (YTD)" value={summary.hrExpenseYtd} kind="currency" />
        </div>
        <p className="mt-3 text-xs text-muted-theme">
          Formula: Revenue ÷ HR Expense
          {summary.referenceDate ? ` · Reference ${summary.referenceDate}` : ''}
        </p>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Monthly HR Expense Entry</p>
          <h3 className="cc-panel-title">Maintain HR expense by month</h3>
        </div>

        <div className="mb-5 grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-theme">Month</span>
            <select
              className={inputClass}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
            >
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-theme">Year</span>
            <select
              className={inputClass}
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-theme">HR Expense</span>
            <IndianRupeeIntegerInput
              value={amount}
              onChange={setAmount}
              inputClassName={rupeeInputClass}
              aria-label="HR expense amount"
            />
          </label>
          <button
            type="button"
            className="piano-button inline-flex min-h-10 items-center justify-center px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {existingForSelection ? (
          <p className="mb-4 text-xs text-muted-theme">
            Editing existing entry for {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}.
          </p>
        ) : null}

        <div className="cc-copq-sources-table-wrap overflow-x-auto">
          <table className="cc-pbt-table w-full text-sm">
            <thead>
              <tr>
                <th>Financial Year</th>
                <th>Month</th>
                <th>HR Expense</th>
                <th>Last Updated</th>
                <th>Updated By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {hrExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-theme">No HR expense entries yet. Use the form above to add the first month.</td>
                </tr>
              ) : hrExpenses.map((record) => {
                const monthLabel = MONTHS.find((month) => month.value === record.month)?.label ?? `Month ${record.month}`;
                const fyStart = record.month >= 4 ? record.calendarYear : record.calendarYear - 1;
                const isSelected = record.month === selectedMonth && record.calendarYear === selectedYear;
                return (
                  <tr
                    key={record.id}
                    className={isSelected ? 'bg-[var(--surface-muted)]' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="text-left font-medium text-primary-theme hover:underline"
                        onClick={() => loadRecordIntoForm(record)}
                      >
                        {`FY ${fyStart}-${String(fyStart + 1).slice(-2)}`}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => loadRecordIntoForm(record)}
                      >
                        {`${monthLabel} ${record.calendarYear}`}
                      </button>
                    </td>
                    <td className="font-medium text-primary-theme">{formatCurrencyDisplay(record.hrExpense)}</td>
                    <td>{new Date(record.updatedAt).toLocaleString('en-IN')}</td>
                    <td>{record.updatedByName ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--danger)] hover:underline disabled:opacity-50"
                        disabled={deletingKey === record.id}
                        onClick={() => void handleDelete(record)}
                      >
                        {deletingKey === record.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Trend</p>
          <h3 className="cc-panel-title">Productivity Index over time</h3>
        </div>
        {chartData.length > 0 ? (
          <TrendAreaChart
            data={chartData}
            trendDirection="higher_is_better"
            formatter={(value) => (value === null ? '—' : formatCompactRatio(value))}
            showDots
            snapshotXAxis
          />
        ) : (
          <p className="text-sm text-muted-theme">Add HR expense entries to plot productivity over time.</p>
        )}
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <p className="eyebrow">Data Sources</p>
          <h3 className="cc-panel-title">How productivity is calculated</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {dataSources.map((source) => (
            <div key={source.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="font-medium text-primary-theme">{source.name}</p>
              <p className="text-sm text-secondary-theme">{source.purpose}</p>
              <p className="mt-1 text-xs text-muted-theme">{source.refreshType}</p>
            </div>
          ))}
        </div>
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
    </div>
  );
}
