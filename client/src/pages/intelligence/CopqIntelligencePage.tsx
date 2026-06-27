import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import CopqIntelligenceModule from '../../components/command-center/CopqIntelligenceModule';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function CopqIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout
      title="COPQ Intelligence"
      subtitle="Understand what is driving total cost of poor quality across categories, departments, products, and NC records."
    >
      <ExecutiveSummary title={data.summaries.copq.title} bullets={data.summaries.copq.bullets} />
      <CopqIntelligenceModule copq={data.copq} />
    </IntelligenceLayout>
  );
}
