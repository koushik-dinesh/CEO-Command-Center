import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function mapRow(row) {
    return {
        id: row.id,
        financialYear: row.financialYear,
        month: row.month,
        calendarYear: row.calendarYear,
        hrExpense: toNumber(row.hrExpense),
        updatedBy: row.updatedBy,
        updatedByName: row.updatedByName ?? null,
        updatedByEmail: row.updatedByEmail ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
const SELECT_WITH_USER = `
  SELECT h.*, u.name AS updatedByName, u.email AS updatedByEmail
  FROM hr_expenses h
  LEFT JOIN users u ON u.id = h.updatedBy
`;
export class HrExpenseRepository {
    static async findByCalendarMonth(month, calendarYear) {
        const row = await queryOne(`${SELECT_WITH_USER} WHERE h.calendarYear = ? AND h.month = ? LIMIT 1`, [calendarYear, month]);
        return row ? mapRow(row) : null;
    }
    static async findById(id) {
        const row = await queryOne(`${SELECT_WITH_USER} WHERE h.id = ? LIMIT 1`, [id]);
        return row ? mapRow(row) : null;
    }
    static async listAll() {
        const rows = await queryRows(`${SELECT_WITH_USER} ORDER BY h.calendarYear DESC, h.month DESC`);
        return rows.map(mapRow);
    }
    static async create(data) {
        const id = createId('hre');
        await execute(`INSERT INTO hr_expenses (id, financialYear, month, calendarYear, hrExpense, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)`, [id, data.financialYear, data.month, data.calendarYear, data.hrExpense, data.updatedBy]);
        const row = await this.findById(id);
        if (!row)
            throw new Error('HR expense not found after create');
        return row;
    }
    static async update(id, hrExpense, updatedBy) {
        if (updatedBy) {
            await execute(`UPDATE hr_expenses
         SET hrExpense = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP(3)
         WHERE id = ?`, [hrExpense, updatedBy, id]);
        }
        else {
            await execute(`UPDATE hr_expenses
         SET hrExpense = ?, updatedAt = CURRENT_TIMESTAMP(3)
         WHERE id = ?`, [hrExpense, id]);
        }
        const row = await this.findById(id);
        if (!row)
            throw new Error('HR expense not found after update');
        return row;
    }
    static async deleteByCalendarMonth(month, calendarYear) {
        const result = await execute('DELETE FROM hr_expenses WHERE calendarYear = ? AND month = ?', [calendarYear, month]);
        return result.affectedRows !== 0;
    }
}
