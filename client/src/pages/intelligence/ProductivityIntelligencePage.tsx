import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import ProductivityIntelligenceModule from '../../components/command-center/ProductivityIntelligenceModule';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function ProductivityIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout
      title="Productivity Index Intelligence"
      subtitle="Revenue divided by HR expense — track productivity and maintain monthly HR expense entries."
    >
      <ExecutiveSummary title={data.summaries.productivity.title} bullets={data.summaries.productivity.bullets} />
      <ProductivityIntelligenceModule productivity={data.productivity} />
    </IntelligenceLayout>
  );
}
