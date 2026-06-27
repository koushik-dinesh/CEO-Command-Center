import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
const [, , sqlPath] = process.argv;
if (!sqlPath) {
    console.error('Usage: tsx scripts/runSql.ts <sql-file>');
    process.exit(1);
}
const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
});
try {
    const sql = await readFile(new URL(`../${sqlPath}`, import.meta.url), 'utf8');
    await connection.query(sql);
    console.log(`Executed ${sqlPath}`);
}
finally {
    await connection.end();
}
