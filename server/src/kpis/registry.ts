import { calculators } from './calculators.js';
import type { KpiCode, KpiCalculator } from './types.js';

const registry = new Map<KpiCode, KpiCalculator>(calculators.map((calculator) => [calculator.code, calculator]));

export function getCalculator(code: string): KpiCalculator | undefined {
  return registry.get(code as KpiCode);
}

export function listCalculators(): KpiCalculator[] {
  return [...registry.values()];
}

export function allKpiCodes(): KpiCode[] {
  return [...registry.keys()];
}
