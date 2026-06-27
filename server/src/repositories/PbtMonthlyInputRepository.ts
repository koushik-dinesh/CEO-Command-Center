import type { RowDataPacket } from 'mysql2';
import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';

interface PbtMonthlyInputDbRow extends RowDataPacket {
  id: string;
  month: number;
  year: number;
  directExpense: string;
  indirectExpense: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PbtMonthlyInputRow {
  id: string;
  month: number;
  year: number;
  directExpense: number;
  /** Additional indirect expense only; HR expense is merged at calculation time. */
  indirectExpense: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRow(row: PbtMonthlyInputDbRow): PbtMonthlyInputRow {
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
  static async findByMonthYear(month: number, year: number): Promise<PbtMonthlyInputRow | null> {
    const row = await queryOne<PbtMonthlyInputDbRow>(
      'SELECT * FROM pbt_monthly_inputs WHERE month = ? AND year = ? LIMIT 1',
      [month, year],
    );
    return row ? mapRow(row) : null;
  }

  static async findById(id: string): Promise<PbtMonthlyInputRow | null> {
    const row = await queryOne<PbtMonthlyInputDbRow>(
      'SELECT * FROM pbt_monthly_inputs WHERE id = ? LIMIT 1',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  static async listAll(): Promise<PbtMonthlyInputRow[]> {
    const rows = await queryRows<PbtMonthlyInputDbRow>(
      'SELECT * FROM pbt_monthly_inputs ORDER BY year DESC, month DESC',
    );
    return rows.map(mapRow);
  }

  static async findLatest(): Promise<PbtMonthlyInputRow | null> {
    const row = await queryOne<PbtMonthlyInputDbRow>(
      'SELECT * FROM pbt_monthly_inputs ORDER BY year DESC, month DESC LIMIT 1',
    );
    return row ? mapRow(row) : null;
  }

  static async create(data: {
    month: number;
    year: number;
    directExpense: number;
    indirectExpense: number;
    createdBy: string;
  }): Promise<PbtMonthlyInputRow> {
    const id = createId('pbt');
    await execute(
      `INSERT INTO pbt_monthly_inputs (id, month, year, directExpense, indirectExpense, createdBy)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.month, data.year, data.directExpense, data.indirectExpense, data.createdBy],
    );
    const row = await this.findById(id);
    if (!row) throw new Error('PBT input not found after create');
    return row;
  }

  static async update(
    id: string,
    data: { directExpense: number; indirectExpense: number },
  ): Promise<PbtMonthlyInputRow> {
    await execute(
      `UPDATE pbt_monthly_inputs
       SET directExpense = ?, indirectExpense = ?, updatedAt = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [data.directExpense, data.indirectExpense, id],
    );
    const row = await this.findById(id);
    if (!row) throw new Error('PBT input not found after update');
    return row;
  }
}
