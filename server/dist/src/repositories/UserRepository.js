import { execute, queryOne } from '../db/mysql.js';
function mapUser(row) {
    if (!row)
        return null;
    return { ...row, isActive: Boolean(row.isActive) };
}
export class UserRepository {
    static async findByEmail(email) {
        return mapUser(await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]));
    }
    static async findById(id) {
        return mapUser(await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [id]));
    }
    static async updateLastLogin(id) {
        const loggedInAt = new Date();
        await execute('UPDATE users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?', [loggedInAt, loggedInAt, id]);
    }
}
