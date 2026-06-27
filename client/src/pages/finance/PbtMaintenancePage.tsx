import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { PbtCalculatedRecord } from '../../types/pbt';
import { formatCurrencyDisplay, formatCurrencyInput, parseCurrencyInput } from '../../utils/currencyInput';
import IndianRupeeIntegerInput from '../../components/ui/IndianRupeeIntegerInput';
import PrecisionValue from '../../components/ui/PrecisionValue';

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

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
    </div>
  );
}

export default function PbtMaintenancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [directExpense, setDirectExpense] = useState('');
  const [additionalIndirectExpense, setAdditionalIndirectExpense] = useState<number | null>(0);
  const [hrExpense, setHrExpense] = useState<number | null>(null);
  const [revenue, setRevenue] = useState<number | null>(null);
  const [existingRecord, setExistingRecord] = useState<PbtCalculatedRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [baseline, setBaseline] = useState({ direct: '', additional: 0 as number | null });

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - 2 + i);
  }, [now]);

  const refreshHrExpense = useCallback(async (m: number, y: number) => {
    const response = await api.pbtHrExpense(y, m);
    setHrExpense(response.hrExpense);
    return response.hrExpense;
  }, []);

  const loadPeriod = useCallback(async (m: number, y: number) => {
    setIsLoading(true);
    setErrors({});
    try {
      const [revenueRes, recordRes, hr] = await Promise.all([
        api.pbtRevenue(y, m),
        api.pbtGetInput(y, m).catch(() => null),
        refreshHrExpense(m, y),
      ]);
      setRevenue(revenueRes.revenue);
      const record = recordRes as PbtCalculatedRecord | null;
      setExistingRecord(record?.id ? record : null);
      const direct = record?.directExpense != null ? formatCurrencyInput(record.directExpense) : '';
      const additional = record?.additionalIndirectExpense ?? 0;
      setDirectExpense(direct);
      setAdditionalIndirectExpense(additional);
      setHrExpense(hr ?? record?.hrExpense ?? null);
      setBaseline({ direct, additional });
    } catch {
      setToast({ message: 'Failed to load period data.', kind: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [refreshHrExpense]);

  useEffect(() => {
    void loadPeriod(month, year);
  }, [month, year, loadPeriod]);

  useEffect(() => {
    function onFocus() {
      void refreshHrExpense(month, year);
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [month, year, refreshHrExpense]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const directValue = parseCurrencyInput(directExpense);
  const additionalValue = additionalIndirectExpense ?? 0;
  const totalIndirectExpense = (hrExpense ?? 0) + additionalValue;

  const livePbt = useMemo(() => {
    if (revenue === null || directValue === null) return null;
    return revenue - (directValue + totalIndirectExpense);
  }, [revenue, directValue, totalIndirectExpense]);

  const hasUnsavedChanges = directExpense !== baseline.direct || additionalIndirectExpense !== baseline.additional;

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (directValue === null) next.directExpense = 'Enter a valid direct expense amount';
    else if (directValue < 0) next.directExpense = 'Direct expense cannot be negative';
    if (additionalIndirectExpense === null) {
      next.additionalIndirectExpense = 'Enter a valid additional indirect expense amount';
    } else if (additionalIndirectExpense < 0) {
      next.additionalIndirectExpense = 'Additional indirect expense cannot be negative';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function performSave() {
    if (!validate() || directValue === null || additionalIndirectExpense === null) return;
    setIsSaving(true);
    try {
      if (existingRecord) {
        await api.pbtUpdateInput(year, month, {
          directExpense: directValue,
          additionalIndirectExpense,
        });
        setToast({ message: 'Monthly PBT inputs updated successfully.', kind: 'success' });
      } else {
        await api.pbtCreateInput({
          month,
          year,
          directExpense: directValue,
          additionalIndirectExpense,
        });
        setToast({ message: 'Monthly PBT inputs saved successfully.', kind: 'success' });
      }
      await loadPeriod(month, year);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      if (message.includes('already exists')) {
        setShowOverwriteConfirm(true);
      } else {
        setToast({ message, kind: 'error' });
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleSaveClick() {
    if (!validate()) return;
    if (existingRecord && hasUnsavedChanges) {
      setShowOverwriteConfirm(true);
      return;
    }
    void performSave();
  }

  function handleExpenseChange(
    value: string,
    setter: (v: string) => void,
  ) {
    const cleaned = value.replace(/[^\d.,]/g, '').replace(/,/g, '');
    if (cleaned === '') {
      setter('');
      return;
    }
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) && normalized !== '.') return;
    setter(formatCurrencyInput(parsed));
  }

  return (
    <>
      {toast ? (
        <div className={`fixed right-6 top-24 z-50 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-2xl backdrop-blur ${toast.kind === 'success' ? 'toast-success' : 'error-banner'}`}>
          {toast.message}
        </div>
      ) : null}

      {showOverwriteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-primary-theme">Overwrite existing data?</h3>
            <p className="mt-2 text-sm text-secondary-theme">
              A record already exists for {MONTHS.find((m) => m.value === month)?.label} {year}.
              Saving will replace the current direct and additional indirect expense values.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="piano-button inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  setShowOverwriteConfirm(false);
                  void performSave();
                }}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Confirm & Save'}
              </button>
              <button
                type="button"
                className="piano-button-secondary inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold"
                onClick={() => setShowOverwriteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="cc-hero dashboard-panel mb-6 p-5 md:p-6">
        <p className="eyebrow">Finance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary-theme">Profit Before Tax</h1>
        <p className="mt-2 max-w-2xl text-sm text-secondary-theme">
          Enter monthly direct expenses and additional indirect expenses. HR expense is pulled automatically from the Productivity Index.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link to="/intelligence/profit-before-tax" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            View PBT intelligence →
          </Link>
          <Link to="/intelligence/productivity" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            Manage HR expense →
          </Link>
        </div>
      </section>

      <section className="cc-panel p-5 md:p-6">
        <div className="cc-panel-head mb-6">
          <p className="eyebrow">Monthly Inputs</p>
          <h2 className="cc-panel-title">PBT expense entry</h2>
          {hasUnsavedChanges ? (
            <p className="mt-1 text-xs font-medium text-[var(--warning)]">Unsaved changes</p>
          ) : null}
        </div>

        {isLoading ? <FormSkeleton /> : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-secondary-theme">Month</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-primary-theme outline-none focus:border-[var(--accent-muted)]"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-secondary-theme">Year</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-primary-theme outline-none focus:border-[var(--accent-muted)]"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-secondary-theme">Revenue</span>
                <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-primary-theme">
                  {formatCurrencyDisplay(revenue)}
                  <span className="ml-2 text-xs text-muted-theme">Auto from revenue reports</span>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-secondary-theme">Direct Expense</span>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-theme">₹</span>
                  <input
                    className={`w-full rounded-xl border bg-[var(--surface-raised)] py-3 pl-8 pr-4 text-sm text-primary-theme outline-none transition focus:border-[var(--accent-muted)] ${errors.directExpense ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)]'}`}
                    value={directExpense}
                    onChange={(e) => handleExpenseChange(e.target.value, setDirectExpense)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
                {errors.directExpense ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.directExpense}</p> : null}
              </label>

              <div className="block">
                <span className="text-sm font-medium text-secondary-theme">Indirect Expense</span>
                <p className="mt-1 text-xs text-muted-theme">
                  HR expense is included automatically from Productivity Index. Enter only additional indirect costs below.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div
                    className="cc-pbt-hr-tag"
                    title="Synced from Productivity Index — included in PBT automatically"
                  >
                    <span className="cc-pbt-hr-tag-label">HR Expense</span>
                    <span className="cc-pbt-hr-tag-value">{formatCurrencyDisplay(hrExpense)}</span>
                    <span className="cc-pbt-hr-tag-badge">Auto</span>
                  </div>
                  <span className="hidden text-lg font-medium text-muted-theme sm:inline" aria-hidden>+</span>
                  <div className="min-w-[min(100%,14rem)] flex-1">
                    <label className="mb-1 block text-xs text-muted-theme sm:sr-only">Additional Indirect Expenses</label>
                    <IndianRupeeIntegerInput
                      value={additionalIndirectExpense}
                      onChange={setAdditionalIndirectExpense}
                      inputClassName={`w-full rounded-xl border bg-[var(--surface-raised)] py-3 pl-8 pr-4 text-sm text-primary-theme outline-none transition focus:border-[var(--accent-muted)] ${errors.additionalIndirectExpense ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)]'}`}
                      placeholder="0"
                      aria-label="Additional indirect expenses"
                    />
                  </div>
                </div>
                {hrExpense === null ? (
                  <p className="mt-2 text-xs text-[var(--warning)]">
                    No HR expense for this month yet.{' '}
                    <Link to="/intelligence/productivity" className="font-semibold underline">
                      Add it in Productivity Index
                    </Link>
                    {' '}to include it in indirect expense.
                  </p>
                ) : null}
                {errors.additionalIndirectExpense ? (
                  <p className="mt-1 text-xs text-[var(--danger)]">{errors.additionalIndirectExpense}</p>
                ) : null}
              </div>

              <div className="cc-pbt-actions">
                {!existingRecord ? (
                  <button
                    type="button"
                    className="piano-button inline-flex min-h-11 items-center justify-center px-7 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleSaveClick()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving…' : 'Save monthly inputs'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="piano-button inline-flex min-h-11 items-center justify-center px-7 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleSaveClick()}
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    {isSaving ? 'Updating…' : 'Update monthly inputs'}
                  </button>
                )}
              </div>
            </div>

            <aside className="cc-pbt-live-card rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-theme">Live Calculation</p>
              <p className="mt-2 text-sm text-secondary-theme">Profit Before Tax</p>
              <PrecisionValue
                value={livePbt}
                kind="currency"
                className="mt-1 text-2xl font-semibold executive-numeral text-primary-theme"
                block
              />
              <div className="mt-5 space-y-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-secondary-theme">
                <div className="flex justify-between gap-3">
                  <span>Revenue</span>
                  <PrecisionValue value={revenue} kind="currency" />
                </div>
                <div className="flex justify-between gap-3">
                  <span>Direct</span>
                  <span>− <PrecisionValue value={directValue} kind="currency" /></span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>HR Expense</span>
                  <span>− <PrecisionValue value={hrExpense} kind="currency" /></span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Additional Indirect</span>
                  <span>− <PrecisionValue value={additionalValue} kind="currency" /></span>
                </div>
                <div className="flex justify-between gap-3 border-t border-[var(--border-subtle)] pt-2 font-medium text-primary-theme">
                  <span>Total Indirect</span>
                  <span>− <PrecisionValue value={totalIndirectExpense} kind="currency" /></span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
