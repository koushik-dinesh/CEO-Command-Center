import { Decimal } from 'decimal.js';
import { financialQuarterStartDate } from '../copq/copqPeriods.js';
import { financialYearStartDate, parseSnapshotDate } from '../command-center/inventoryDays.js';
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function financialYearFromCalendar(calendarYear, month) {
    return month >= 4 ? calendarYear : calendarYear - 1;
}
export function financialYearLabel(financialYear) {
    const end = String(financialYear + 1).slice(-2);
    return `FY ${financialYear}-${end}`;
}
export function monthShortLabel(month, calendarYear) {
    return `${SHORT_MONTHS[month - 1] ?? `M${month}`}-${calendarYear}`;
}
export function calculateProductivityIndex(revenue, hrExpense) {
    if (revenue === null || hrExpense === null || hrExpense <= 0)
        return null;
    return new Decimal(revenue).div(hrExpense).toDecimalPlaces(2).toNumber();
}
function monthKey(calendarYear, month) {
    return `${calendarYear}-${String(month).padStart(2, '0')}`;
}
export function enumerateCalendarMonths(start, end) {
    const months = [];
    let year = start.calendarYear;
    let month = start.month;
    while (year < end.calendarYear || (year === end.calendarYear && month <= end.month)) {
        months.push({ calendarYear: year, month });
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return months;
}
function calendarMonthFromDateKey(dateKey) {
    const match = /^(\d{4})-(\d{2})/.exec(dateKey);
    if (!match)
        return null;
    const calendarYear = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(calendarYear) || !Number.isInteger(month) || month < 1 || month > 12)
        return null;
    return { calendarYear, month };
}
export function monthsForMtd(referenceDate) {
    const parsed = calendarMonthFromDateKey(referenceDate);
    return parsed ? [parsed] : [];
}
export function monthsForYtd(referenceDate) {
    const fyStart = financialYearStartDate(referenceDate);
    const end = calendarMonthFromDateKey(referenceDate);
    const start = fyStart ? calendarMonthFromDateKey(fyStart) : null;
    if (!start || !end)
        return [];
    return enumerateCalendarMonths(start, end);
}
export function monthsForQtd(referenceDate) {
    const quarterStart = financialQuarterStartDate(referenceDate);
    const end = calendarMonthFromDateKey(referenceDate);
    const start = quarterStart ? calendarMonthFromDateKey(quarterStart) : null;
    if (!start || !end)
        return [];
    return enumerateCalendarMonths(start, end);
}
export function sumHrExpenses(records, months) {
    if (months.length === 0)
        return null;
    const keys = new Set(months.map((entry) => monthKey(entry.calendarYear, entry.month)));
    let total = new Decimal(0);
    let matched = 0;
    for (const record of records) {
        if (!keys.has(monthKey(record.calendarYear, record.month)))
            continue;
        total = total.plus(record.hrExpense);
        matched += 1;
    }
    if (matched === 0)
        return null;
    return total.toDecimalPlaces(2).toNumber();
}
export function validateHrExpenseValue(value) {
    if (typeof value === 'string' && value.trim() === '') {
        throw new Error('HR expense is required');
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error('HR expense must be a valid number');
    }
    if (parsed <= 0) {
        throw new Error('HR expense must be greater than zero');
    }
    return new Decimal(parsed).toDecimalPlaces(2).toNumber();
}
export function validateMonthYear(month, year) {
    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
        throw new Error('Month must be between 1 and 12');
    }
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        throw new Error('Year must be between 2000 and 2100');
    }
    return { month: m, calendarYear: y };
}
export function referenceDateFromSnapshot(snapshotDate) {
    const parsed = parseSnapshotDate(snapshotDate);
    if (!parsed)
        return null;
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
