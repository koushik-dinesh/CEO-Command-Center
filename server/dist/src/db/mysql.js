import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
const baseOptions = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
};
export const pool = mysql.createPool({
    ...baseOptions,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    maxIdle: Math.max(1, Math.floor(env.DB_CONNECTION_LIMIT / 2)),
    idleTimeout: 60_000,
    enableKeepAlive: true,
    namedPlaceholders: true,
    decimalNumbers: false,
    timezone: 'Z',
});
export async function queryRows(sql, params = [], executor = pool) {
    const [rows] = await executor.query(sql, params);
    return rows;
}
export async function queryOne(sql, params = [], executor = pool) {
    const rows = await queryRows(sql, params, executor);
    return rows[0] ?? null;
}
export async function execute(sql, params = [], executor = pool) {
    const [result] = await executor.execute(sql, params);
    return result;
}
export async function transaction(callback) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
export async function closePool() {
    await pool.end();
}
