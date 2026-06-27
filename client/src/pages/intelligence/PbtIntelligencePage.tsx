import { Link } from 'react-router-dom';
import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { PbtModule } from '../../components/command-center/IntelligenceModules';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function PbtIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout
      title="Profit Before Tax Intelligence"
      subtitle="Revenue minus operating expenses, monthly trends, and executive insights."
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/finance/profit-before-tax"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold text-primary-theme transition hover:border-[var(--accent-muted)]"
        >
          Manage monthly inputs →
        </Link>
      </div>
      <ExecutiveSummary title={data.summaries.pbt.title} bullets={data.summaries.pbt.bullets} />
      <PbtModule pbt={data.pbt} />
    </IntelligenceLayout>
  );
}
