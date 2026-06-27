import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { RevenueModule } from '../../components/command-center/IntelligenceModules';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function RevenueIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout title="Revenue Intelligence" subtitle="Where revenue comes from, who drives growth, and what changed.">
      <ExecutiveSummary title={data.summaries.revenue.title} bullets={data.summaries.revenue.bullets} />
      <RevenueModule revenue={data.revenue} />
    </IntelligenceLayout>
  );
}
