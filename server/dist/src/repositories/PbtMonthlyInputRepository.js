import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function mapRow(row) {
    return {
        id: row.id,
        month: row.month,
        year: row.year,
        directExpense: toNumber(row.directExpense),
        indirectExpense: toNumber(row.indirectExpense),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
export class PbtMonthlyInputRepository {
    static async findByMonthYear(month, year) {
        const row = await queryOne('SELECT * FROM pbt_monthly_inputs WHERE month = ? AND year = ? LIMIT 1', [month, year]);
        return row ? mapRow(row) : null;
    }
    static async findById(id) {
        const row = await queryOne('SELECT * FROM pbt_monthly_inputs WHERE id = ? LIMIT 1', [id]);
        return row ? mapRow(row) : null;
    }
    static async listAll() {
        const rows = await queryRows('SELECT * FROM pbt_monthly_inputs ORDER BY year DESC, month DESC');
        return rows.map(mapRow);
    }
    static async findLatest() {
        const row = await queryOne('SELECT * FROM pbt_monthly_inputs ORDER BY year DESC, month DESC LIMIT 1');
        return row ? mapRow(row) : null;
    }
    static async create(data) {
        const id = createId('pbt');
        await execute(`INSERT INTO pbt_monthly_inputs (id, month, year, directExpense, indirectExpense, createdBy)
       VALUES (?, ?, ?, ?, ?, ?)`, [id, data.month, data.year, data.directExpense, data.indirectExpense, data.createdBy]);
        const row = await this.findById(id);
        if (!row)
            throw new Error('PBT input not found after create');
        return row;
    }
    static async update(id, data) {
        await execute(`UPDATE pbt_monthly_inputs
       SET directExpense = ?, indirectExpense = ?, updatedAt = CURRENT_TIMESTAMP(3)
       WHERE id = ?`, [data.directExpense, data.indirectExpense, id]);
        const row = await this.findById(id);
        if (!row)
            throw new Error('PBT input not found after update');
        return row;
    }
}
