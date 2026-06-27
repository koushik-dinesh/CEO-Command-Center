function readPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
/** Configurable inventory-days target range (days). Override via environment variables. */
export function getInventoryDaysTargetMin() {
    return readPositiveNumber(process.env.INVENTORY_DAYS_TARGET_MIN, 60);
}
export function getInventoryDaysTargetMax() {
    return readPositiveNumber(process.env.INVENTORY_DAYS_TARGET_MAX, 90);
}
export function getInventoryDaysTargets() {
    const targetMinDays = getInventoryDaysTargetMin();
    const targetMaxDays = getInventoryDaysTargetMax();
    return {
        targetMinDays: Math.min(targetMinDays, targetMaxDays),
        targetMaxDays: Math.max(targetMinDays, targetMaxDays),
    };
}
