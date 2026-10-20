import "server-only";
import mysql, { RowDataPacket } from "mysql2/promise";
import { attachDatabasePool } from "@vercel/functions";
const globalDb = globalThis as unknown as { dbPool?: mysql.Pool };
export function pool() {
  if (!process.env.DB_USER || process.env.DB_PASSWORD === undefined)
    throw new Error("DB_NOT_CONFIGURED");
  if (globalDb.dbPool) return globalDb.dbPool;
  const hosted = process.env.VERCEL === "1";
  const sslEnabled = hosted || process.env.DB_SSL === "true";
  if (
    hosted &&
    (!process.env.DB_HOST ||
      ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST))
  )
    throw new Error("HOSTED_DATABASE_REQUIRED");
  const dbPool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "attendease",
    connectionLimit: hosted ? 3 : 10,
    maxIdle: hosted ? 1 : 10,
    idleTimeout: 5000,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: true,
          ...(process.env.DB_SSL_CA
            ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") }
            : {}),
        }
      : undefined,
    dateStrings: true,
    decimalNumbers: true,
    connectTimeout: 5000,
  });
  // The promise wrapper has no config property; attach to its underlying MySQL2 pool.
  if (hosted) attachDatabasePool(dbPool.pool);
  globalDb.dbPool = dbPool;
  return dbPool;
}
export async function rows<T = Record<string, unknown>>(
  sql: string,
  values: (string | number | null)[] = [],
): Promise<T[]> {
  const [result] = await pool().execute<RowDataPacket[]>(sql, values);
  return result as T[];
}
