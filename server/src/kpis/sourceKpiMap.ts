import { listCalculators } from './registry.js';
import type { KpiCode } from './types.js';

export function resolveKpiCodesForSources(sourceCodes: string[]): KpiCode[] {
  if (sourceCodes.length === 0) return [];

  const changed = new Set(sourceCodes);
  const codes = new Set<KpiCode>();

  for (const calculator of listCalculators()) {
    if (calculator.requiredSources.some((sourceCode) => changed.has(sourceCode))) {
      codes.add(calculator.code);
    }
  }

  return [...codes];
}
