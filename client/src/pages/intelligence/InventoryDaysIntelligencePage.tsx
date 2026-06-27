import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import InventoryDaysIntelligenceModule from '../../components/command-center/InventoryDaysIntelligenceModule';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function InventoryDaysIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout
      title="Inventory Days Intelligence"
      subtitle="Current inventory, YTD COGS, days elapsed, and inventory days calculation."
    >
      <ExecutiveSummary title={data.summaries.inventoryDays.title} bullets={data.summaries.inventoryDays.bullets} />
      <InventoryDaysIntelligenceModule inventoryDays={data.inventoryDays} />
    </IntelligenceLayout>
  );
}
