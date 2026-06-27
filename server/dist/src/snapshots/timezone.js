import { env } from '../config/env.js';
export function getTimezone() {
    return env.DEFAULT_TIMEZONE;
}
export function getZonedParts(date, timeZone = getTimezone()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute'),
    };
}
export function formatISODateInTimezone(date, timeZone = getTimezone()) {
    const { year, month, day } = getZonedParts(date, timeZone);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function minutesSinceMidnight(date, timeZone = getTimezone()) {
    const { hour, minute } = getZonedParts(date, timeZone);
    return hour * 60 + minute;
}
