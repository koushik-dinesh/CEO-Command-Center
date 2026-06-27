import type { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../db/mysql.js';
import type { UserRow } from '../db/types.js';

interface UserDbRow extends RowDataPacket {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapUser(row: UserDbRow | null): UserRow | null {
  if (!row) return null;
  return { ...row, isActive: Boolean(row.isActive) };
}

export class UserRepository {
  static async findByEmail(email: string): Promise<UserRow | null> {
    return mapUser(await queryOne<UserDbRow>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]));
  }

  static async findById(id: string): Promise<UserRow | null> {
    return mapUser(await queryOne<UserDbRow>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]));
  }

  static async updateLastLogin(id: string): Promise<void> {
    const loggedInAt = new Date();
    await execute('UPDATE users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?', [loggedInAt, loggedInAt, id]);
  }
}
