import { execute } from '../db/mysql.js';
export class DataSourceMutationRepository {
    static async updateLastCheckedAt(id, executor) {
        const checkedAt = new Date();
        await execute('UPDATE data_sources SET lastCheckedAt = ?, updatedAt = ? WHERE id = ?', [checkedAt, checkedAt, id], executor);
    }
}
