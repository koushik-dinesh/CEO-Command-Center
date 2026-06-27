import { useCallback, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  formatCompactCurrency,
  formatExactCurrency,
  formatExactPercent,
  formatPercent,
  formatSignedPercentDisplay,
  formatSignedPercentExact,
} from '../../utils/command-center';

type PrecisionKind = 'currency' | 'percent';

interface PrecisionValueProps {
  value: number | null;
  kind: PrecisionKind;
  percentDigits?: number;
  className?: string;
  display?: string;
  signed?: boolean;
  block?: boolean;
}

interface TooltipPosition {
  x: number;
  y: number;
}

const CURSOR_OFFSET_X = 14;
const CURSOR_OFFSET_Y = 16;
const ESTIMATED_TOOLTIP_WIDTH = 168;
const ESTIMATED_TOOLTIP_HEIGHT = 34;

function resolveDisplay(value: number, kind: PrecisionKind, percentDigits: number, signed: boolean, display?: string): string {
  if (display) return display;
  if (kind === 'currency') return formatCompactCurrency(value);
  if (signed) return formatSignedPercentDisplay(value, percentDigits);
  return formatPercent(value, percentDigits);
}

function resolveExact(value: number, kind: PrecisionKind, signed: boolean): string {
  if (kind === 'currency') return formatExactCurrency(value);
  if (signed) return formatSignedPercentExact(value);
  return formatExactPercent(value);
}

function positionNearCursor(clientX: number, clientY: number): TooltipPosition {
  const pad = 8;
  let x = clientX + CURSOR_OFFSET_X;
  let y = clientY + CURSOR_OFFSET_Y;

  if (x + ESTIMATED_TOOLTIP_WIDTH > window.innerWidth - pad) {
    x = clientX - ESTIMATED_TOOLTIP_WIDTH - CURSOR_OFFSET_X;
  }
  if (y + ESTIMATED_TOOLTIP_HEIGHT > window.innerHeight - pad) {
    y = clientY - ESTIMATED_TOOLTIP_HEIGHT - CURSOR_OFFSET_Y;
  }

  return {
    x: Math.max(pad, x),
    y: Math.max(pad, y),
  };
}

export default function PrecisionValue({
  value,
  kind,
  percentDigits = 1,
  className,
  display,
  signed = false,
  block = false,
}: PrecisionValueProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const fallback = display ?? '—';

  const showAt = useCallback((position: TooltipPosition) => {
    setTooltip(position);
  }, []);

  const hide = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLSpanElement>) => {
    showAt(positionNearCursor(event.clientX, event.clientY));
  }, [showAt]);

  const handleMouseEnter = useCallback((event: MouseEvent<HTMLSpanElement>) => {
    showAt(positionNearCursor(event.clientX, event.clientY));
  }, [showAt]);

  const handleFocus = useCallback((event: FocusEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    showAt(positionNearCursor(rect.left + rect.width / 2, rect.bottom));
  }, [showAt]);

  if (value === null || Number.isNaN(value)) {
    return <span className={className}>{fallback}</span>;
  }

  const displayText = resolveDisplay(value, kind, percentDigits, signed, display);
  const exactText = resolveExact(value, kind, signed);
  const classes = ['precision-value', block ? 'precision-value-block' : '', className].filter(Boolean).join(' ');

  return (
    <>
      <span
        ref={anchorRef}
        className={classes}
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={hide}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {displayText}
      </span>
      {tooltip && createPortal(
        <span
          className="precision-value-tooltip precision-value-tooltip-cursor"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          {exactText}
        </span>,
        document.body,
      )}
    </>
  );
}
