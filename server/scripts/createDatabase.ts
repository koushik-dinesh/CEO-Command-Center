import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

const connection = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
});

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(env.DB_NAME)} DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`Database ${env.DB_NAME} is ready`);
} finally {
  await connection.end();
}
