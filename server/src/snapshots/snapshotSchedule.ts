import { env } from '../config/env.js';
import { formatISODateInTimezone, getTimezone, minutesSinceMidnight } from './timezone.js';

function parseTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function isDiscoveryWindowMinute(now = new Date(), timeZone = getTimezone()): boolean {
  const minutes = minutesSinceMidnight(now, timeZone);
  const start = parseTimeToMinutes(env.SNAPSHOT_DISCOVERY_START);
  const end = parseTimeToMinutes(env.SNAPSHOT_DISCOVERY_END);
  const interval = env.SNAPSHOT_DISCOVERY_INTERVAL_MINUTES;

  if (minutes < start || minutes > end) return false;
  return (minutes - start) % interval === 0;
}

export function isDiscoveryWindowExhausted(now = new Date(), timeZone = getTimezone()): boolean {
  const minutes = minutesSinceMidnight(now, timeZone);
  const end = parseTimeToMinutes(env.SNAPSHOT_DISCOVERY_END);
  return minutes > end;
}

export function todayDateKey(now = new Date(), timeZone = getTimezone()): string {
  return formatISODateInTimezone(now, timeZone);
}

export const DISCOVERY_CRON_EXPRESSIONS = [
  '25,30,35,40,45,50,55 7 * * *',
  '*/5 8 * * *',
  '0 9 * * *',
] as const;

export const MAINTENANCE_CRON_EXPRESSION = env.SNAPSHOT_MAINTENANCE_CRON;
