import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { DeadStockModule } from '../../components/command-center/IntelligenceModules';
import { useCommandCenterContext } from '../../context/CommandCenterContext';
import { ExecutiveInsightsPanel } from '../../components/command-center/Controls';

export default function DeadStockIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  const riskInsights = data.insights.filter((insight) => insight.category === 'risk' || insight.category === 'inventory');

  return (
    <IntelligenceLayout title="Dead & Slow Moving Intelligence" subtitle="Risk inventory, aging exposure, and reduction progress.">
      <ExecutiveSummary title={data.summaries.deadStock.title} bullets={data.summaries.deadStock.bullets} />
      <ExecutiveInsightsPanel insights={riskInsights.length > 0 ? riskInsights : data.insights.slice(0, 4)} />
      <DeadStockModule deadStock={data.deadStock} />
    </IntelligenceLayout>
  );
}
