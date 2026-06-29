import { calculators } from './calculators.js';
const registry = new Map(calculators.map((calculator) => [calculator.code, calculator]));
export function getCalculator(code) {
    return registry.get(code);
}
export function listCalculators() {
    return [...registry.values()];
}
export function allKpiCodes() {
    return [...registry.keys()];
}
