import mysql, { type PoolConnection, type PoolOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';

const baseOptions: PoolOptions = {
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

export type DbExecutor = typeof pool | PoolConnection;

export async function queryRows<T extends RowDataPacket>(sql: string, params: unknown[] = [], executor: DbExecutor = pool): Promise<T[]> {
  const [rows] = await executor.query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(sql: string, params: unknown[] = [], executor: DbExecutor = pool): Promise<T | null> {
  const rows = await queryRows<T>(sql, params, executor);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = [], executor: DbExecutor = pool): Promise<ResultSetHeader> {
  const [result] = await executor.execute<ResultSetHeader>(sql, params as never[]);
  return result;
}

export async function transaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
