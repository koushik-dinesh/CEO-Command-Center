import { listCalculators } from './registry.js';
export function resolveKpiCodesForSources(sourceCodes) {
    if (sourceCodes.length === 0)
        return [];
    const changed = new Set(sourceCodes);
    const codes = new Set();
    for (const calculator of listCalculators()) {
        if (calculator.requiredSources.some((sourceCode) => changed.has(sourceCode))) {
            codes.add(calculator.code);
        }
    }
    return [...codes];
}
