import { Link } from 'react-router-dom';
import IntelligenceLayout from '../../components/command-center/IntelligenceLayout';
import { ExecutiveInsightsPanel } from '../../components/command-center/Controls';
import { ExecutiveSummary } from '../../components/command-center/IntelligenceLayout';
import { useCommandCenterContext } from '../../context/CommandCenterContext';
import { navHref } from '../../config/navigation';

export default function InsightsIntelligencePage() {
  const { data, error, isLoading, snapshotKey } = useCommandCenterContext();

  if (error) return <p className="error-banner rounded-xl px-4 py-3 text-sm">{error}</p>;
  if (isLoading && !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />;
  if (!data) return null;

  const modules = [
    { key: 'revenue', href: '/intelligence/revenue', summary: data.summaries.revenue },
    { key: 'profitability', href: '/intelligence/profitability', summary: data.summaries.profitability },
    { key: 'inventory', href: '/intelligence/inventory', summary: data.summaries.inventory },
    { key: 'deadStock', href: '/intelligence/dead-stock', summary: data.summaries.deadStock },
  ];

  return (
    <IntelligenceLayout title="Executive Insights" subtitle="Cross-functional observations, summaries, and areas requiring attention.">
      <ExecutiveInsightsPanel insights={data.insights} />
      <div className="cc-module-grid">
        {modules.map((module) => (
          <section key={module.key} className="cc-panel space-y-3">
            <ExecutiveSummary title={module.summary.title} bullets={module.summary.bullets} />
            <Link to={navHref(module.href, snapshotKey)} className="cc-kpi-drill inline-block">
              Open module →
            </Link>
          </section>
        ))}
      </div>
    </IntelligenceLayout>
  );
}
