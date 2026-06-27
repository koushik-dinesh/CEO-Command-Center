import IntelligenceLayout, { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { InventoryModule } from '../../components/command-center/IntelligenceModules';
import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function InventoryIntelligencePage() {
  const { data, error, isLoading } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  return (
    <IntelligenceLayout title="Inventory Intelligence" subtitle="Warehouse concentration, inventory movement, and stock distribution.">
      <ExecutiveSummary title={data.summaries.inventory.title} bullets={data.summaries.inventory.bullets} />
      <InventoryModule inventory={data.inventory} />
    </IntelligenceLayout>
  );
}
