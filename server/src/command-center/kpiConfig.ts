function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Configurable inventory-days target range (days). Override via environment variables. */
export function getInventoryDaysTargetMin(): number {
  return readPositiveNumber(process.env.INVENTORY_DAYS_TARGET_MIN, 60);
}

export function getInventoryDaysTargetMax(): number {
  return readPositiveNumber(process.env.INVENTORY_DAYS_TARGET_MAX, 90);
}

export function getInventoryDaysTargets(): { targetMinDays: number; targetMaxDays: number } {
  const targetMinDays = getInventoryDaysTargetMin();
  const targetMaxDays = getInventoryDaysTargetMax();
  return {
    targetMinDays: Math.min(targetMinDays, targetMaxDays),
    targetMaxDays: Math.max(targetMinDays, targetMaxDays),
  };
}
