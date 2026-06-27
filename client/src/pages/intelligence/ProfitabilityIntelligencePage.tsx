import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { ProfitabilityModule } from '../../components/command-center/IntelligenceModules';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function ProfitabilityIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout title="Profitability Intelligence" subtitle="Margin performance, category profitability, and variance signals.">
      <ExecutiveSummary title={data.summaries.profitability.title} bullets={data.summaries.profitability.bullets} />
      <ProfitabilityModule profitability={data.profitability} />
    </IntelligenceLayout>
  );
}
