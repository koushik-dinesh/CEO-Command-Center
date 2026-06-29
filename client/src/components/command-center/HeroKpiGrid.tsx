import { Link } from 'react-router-dom';
import type { KpiMetric } from '../../types/command-center';
import { navHref } from '../../config/navigation';
import {
  resolveKpiVisualSentiment,
  sentimentCssClass,
} from '../../config/kpiSemantics';
import {
  formatCompactCurrency,
  formatCompactDays,
  formatCompactRatio,
  formatExactDays,
  formatExactRatio,
  trendArrow,
} from '../../utils/command-center';
import PrecisionValue from '../ui/PrecisionValue';
import { MiniSparkline } from './Charts';
import KpiSubMetrics from './KpiSubMetrics';

const KPI_ROUTES: Record<string, string> = {
  revenue: '/intelligence/revenue',
  grossProfit: '/intelligence/profitability',
  grossMargin: '/intelligence/profitability',
  inventoryValue: '/intelligence/inventory',
  inventoryDays: '/intelligence/inventory-days',
  deadStock: '/intelligence/dead-stock',
  slowMoving: '/intelligence/dead-stock',
  copq: '/intelligence/copq',
  pbt: '/intelligence/profit-before-tax',
  productivityIndex: '/intelligence/productivity',
};

function kpiDisplayValue(kpi: KpiMetric): string | undefined {
  if (kpi.value === null) return undefined;
  if (kpi.unit === 'days') return formatCompactDays(kpi.value);
  if (kpi.unit === 'ratio') return formatCompactRatio(kpi.value);
  return undefined;
}

function kpiExactPrevious(kpi: KpiMetric): string | undefined {
  if (kpi.previousValue === null) return undefined;
  if (kpi.unit === 'days') return formatExactDays(kpi.previousValue);
  if (kpi.unit === 'ratio') return formatExactRatio(kpi.previousValue);
  return undefined;
}

function sparklineUnit(kpi: KpiMetric): 'currency' | 'percent' | 'days' | 'ratio' {
  if (kpi.unit === 'percent') return 'percent';
  if (kpi.unit === 'days') return 'days';
  if (kpi.unit === 'ratio') return 'ratio';
  return 'currency';
}

function KpiDrillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M4.25 9.75 9.75 4.25M5.5 4.25h4.25V8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeroKpiGrid({ kpis, snapshotKey }: { kpis: KpiMetric[]; snapshotKey: string }) {
  return (
    <section className="cc-kpi-grid">
      {kpis.map((kpi) => {
        const drillPath = kpi.drilldownPath ?? KPI_ROUTES[kpi.key] ?? '/';
        const href = navHref(drillPath, snapshotKey);
        const valueKind = kpi.unit === 'percent' ? 'percent' : 'currency';
        const display = kpiDisplayValue(kpi);
        const previousDisplay = kpiExactPrevious(kpi);
        const visualSentiment = resolveKpiVisualSentiment(kpi);
        const statusTooltip = kpi.statusTooltip ?? undefined;

        return (
          <Link key={kpi.key} to={href} className={`cc-kpi-card cc-kpi-card-link cc-health-${kpi.health}`}>
            <div className="cc-kpi-head">
              <p className="cc-kpi-label">{kpi.label}</p>
              <span
                className={`cc-health-pill ${sentimentCssClass(visualSentiment)}`}
                title={statusTooltip}
              >
                {kpi.trendLabel}
              </span>
            </div>
            <PrecisionValue
              value={kpi.value}
              kind={valueKind}
              className="cc-kpi-value executive-numeral"
              display={display}
              block
            />
            {kpi.subMetrics && kpi.subMetrics.length > 0 ? (
              <KpiSubMetrics subMetrics={kpi.subMetrics} />
            ) : null}
            {kpi.footnote ? (
              <p className="cc-kpi-footnote text-muted-theme">{kpi.footnote}</p>
            ) : null}
            <div className="cc-kpi-meta">
              <span className="cc-kpi-prev text-muted-theme">
                Prev{' '}
                {previousDisplay ? (
                  <span>{previousDisplay}</span>
                ) : (
                  <PrecisionValue
                    value={kpi.previousValue}
                    kind={valueKind}
                  />
                )}
              </span>
              <span
                className={`cc-trend-pill ${sentimentCssClass(visualSentiment)}`}
                title={statusTooltip}
              >
                {trendArrow(kpi.trend)}{' '}
                <PrecisionValue
                  value={kpi.changePercent}
                  kind="percent"
                  signed
                  display={kpi.changePercent !== null ? `${kpi.changePercent > 0 ? '+' : ''}${kpi.changePercent.toFixed(1)}%` : '—'}
                />
              </span>
            </div>
            <MiniSparkline
              data={kpi.history}
              unit={sparklineUnit(kpi)}
              chartSentiment={visualSentiment}
            />
            <span className="cc-kpi-drill-btn" title="View Intelligence">
              <KpiDrillIcon />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
