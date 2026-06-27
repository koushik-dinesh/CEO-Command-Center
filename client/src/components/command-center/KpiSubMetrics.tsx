import { useCallback, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { KpiSubMetric } from '../../types/command-center';
import { formatCompactCurrency, formatCompactDays, formatCompactRatio, formatExactCurrency, formatExactDays, formatExactRatio } from '../../utils/command-center';

interface KpiSubMetricsProps {
  subMetrics: KpiSubMetric[];
}

interface TooltipPosition {
  x: number;
  y: number;
}

const CURSOR_OFFSET_X = 14;
const CURSOR_OFFSET_Y = 16;

function positionNearCursor(clientX: number, clientY: number): TooltipPosition {
  const pad = 8;
  let x = clientX + CURSOR_OFFSET_X;
  let y = clientY + CURSOR_OFFSET_Y;
  if (x + 220 > window.innerWidth - pad) x = clientX - 220 - CURSOR_OFFSET_X;
  if (y + 100 > window.innerHeight - pad) y = clientY - 100 - CURSOR_OFFSET_Y;
  return { x: Math.max(pad, x), y: Math.max(pad, y) };
}

function formatPillDisplay(metric: KpiSubMetric): string {
  if (metric.value === null) return '—';
  if (metric.unit === 'days') return formatCompactDays(metric.value);
  if (metric.unit === 'ratio') return formatCompactRatio(metric.value);
  return formatCompactCurrency(metric.value);
}

function formatTooltipValue(metric: KpiSubMetric): string {
  if (metric.value === null) return '—';
  if (metric.unit === 'days') return formatExactDays(metric.value);
  if (metric.unit === 'ratio') return formatExactRatio(metric.value);
  if (metric.unit === 'percent') return `${metric.value.toFixed(2)}%`;
  return formatExactCurrency(metric.value);
}

export default function KpiSubMetrics({ subMetrics }: KpiSubMetricsProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);

  const headlineTags = subMetrics.filter((m) => m.role === 'headline-tag');
  const pills = subMetrics.filter((m) => m.role === 'pill');

  const showAt = useCallback((position: TooltipPosition) => setTooltip(position), []);
  const hide = useCallback(() => setTooltip(null), []);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    showAt(positionNearCursor(event.clientX, event.clientY));
  }, [showAt]);

  const handleMouseEnter = useCallback((event: MouseEvent<HTMLDivElement>) => {
    showAt(positionNearCursor(event.clientX, event.clientY));
  }, [showAt]);

  const handleFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    showAt(positionNearCursor(rect.left + rect.width / 2, rect.bottom));
  }, [showAt]);

  if (subMetrics.length === 0) return null;

  return (
    <>
      <div
        ref={anchorRef}
        className="cc-kpi-submetrics"
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={hide}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {headlineTags.length > 0 ? (
          <div className="cc-kpi-submetrics-tags">
            {headlineTags.map((metric) => (
              <span key={metric.key} className="cc-kpi-period-tag cc-kpi-period-tag-headline">
                {metric.label}
              </span>
            ))}
          </div>
        ) : null}

        {pills.length > 0 ? (
          <div className="cc-kpi-submetrics-pills">
            {pills.map((metric) => (
              <span key={metric.key} className="cc-kpi-period-tag cc-kpi-period-tag-pill">
                <span className="cc-kpi-period-tag-label">{metric.label}</span>
                <span className="cc-kpi-period-tag-value">{formatPillDisplay(metric)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {tooltip && createPortal(
        <div
          className="precision-value-tooltip cc-kpi-period-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          {subMetrics.map((metric) => (
            <div key={metric.key} className="cc-kpi-period-tooltip-row">
              <span>{metric.label}</span>
              <span>{formatTooltipValue(metric)}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
