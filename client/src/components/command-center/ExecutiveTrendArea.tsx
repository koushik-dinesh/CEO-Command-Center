import type { CommandCenterResponse } from '../../types/command-center';
import { formatPercent } from '../../utils/command-center';
import { TrendAreaChart } from './Charts';

export default function ExecutiveTrendArea({ data }: { data: CommandCenterResponse }) {
  return (
    <section className="cc-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Strategic Direction</p>
        <h3 className="cc-panel-title">Executive trend overview</h3>
      </div>
      <div className="cc-trend-grid">
        <div className="cc-module-card">
          <p className="cc-module-label">Revenue Trend</p>
          <TrendAreaChart data={data.revenue.trend} height={180} trendDirection="higher_is_better" />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Inventory Trend</p>
          <TrendAreaChart data={data.inventory.trend} height={180} trendDirection="lower_is_better" />
        </div>
        <div className="cc-module-card">
          <p className="cc-module-label">Gross Margin Trend</p>
          <TrendAreaChart data={data.profitability.marginTrend} height={180} formatter={(v) => formatPercent(v, 1)} valueKind="percent" trendDirection="higher_is_better" />
        </div>
      </div>
    </section>
  );
}
