import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
dotenv.config({ path: process.env.DB_ENV_FILE || ".env.local", quiet: true });
const action = process.argv[2];
let connection;
try {
  if (!process.env.DB_USER || process.env.DB_PASSWORD === undefined)
    throw Error(
      "Credentials missing. Run npm.cmd run db:configure privately in your terminal.",
    );
  if (process.env.DB_NAME && process.env.DB_NAME !== "attendease")
    throw Error(
      "This setup script only initializes attendease. Set DB_NAME=attendease.",
    );
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(process.env.DB_SSL_CA
              ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") }
              : {}),
          }
        : undefined,
    multipleStatements: true,
    dateStrings: true,
  });
  if (action === "setup") {
    await connection.query(await readFile("database/schema.sql", "utf8"));
    console.log("Schema ready: five InnoDB tables. Existing data preserved.");
  } else {
    await connection.query("USE attendease");
    if (action === "seed") {
      await connection.query(await readFile("database/seed.sql", "utf8"));
      console.log("Sample seed applied. Existing records preserved.");
    } else if (action === "check") {
      const [tables] = await connection.query(
        "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='attendease'",
      );
      console.table(tables);
      const [counts] = await connection.query(
        "SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM subjects) subjects,(SELECT COUNT(*) FROM enrollments) enrollments,(SELECT COUNT(*) FROM class_sessions) sessions,(SELECT COUNT(*) FROM attendance) attendance",
      );
      console.table(counts);
      const [integrity] = await connection.query(
        "SELECT COUNT(*) invalid_rows FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id LEFT JOIN students s ON s.id=a.student_id WHERE s.id IS NULL",
      );
      if (
        tables.length !== 5 ||
        tables.some((t) => t.ENGINE !== "InnoDB") ||
        Number(integrity[0].invalid_rows) !== 0
      )
        throw Error("Schema verification failed.");
      const [foreignKeys] = await connection.execute(
        "SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,COLUMN_NAME",
        ["attendease"],
      );
      assert.deepEqual(
        foreignKeys.map(
          (r) =>
            `${r.TABLE_NAME}.${r.COLUMN_NAME}->${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`,
        ),
        [
          "attendance.session_id->class_sessions.id",
          "attendance.student_id->students.id",
          "class_sessions.subject_id->subjects.id",
          "enrollments.student_id->students.id",
          "enrollments.subject_id->subjects.id",
        ],
      );
      const [deletes] = await connection.execute(
        "SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=?",
        ["attendease"],
      );
      assert.ok(deletes.every((r) => r.DELETE_RULE === "CASCADE"));
      const [uniqueKeys] = await connection.execute(
        "SELECT TABLE_NAME,INDEX_NAME,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND NON_UNIQUE=0 GROUP BY TABLE_NAME,INDEX_NAME",
        ["attendease"],
      );
      for (const [table, cols] of [
        ["students", "roll_no"],
        ["students", "email"],
        ["subjects", "code"],
        ["enrollments", "student_id,subject_id"],
        ["class_sessions", "subject_id,session_date,period_no"],
        ["attendance", "session_id,student_id"],
      ])
        assert.ok(
          uniqueKeys.some((r) => r.TABLE_NAME === table && r.cols === cols),
          `${table} unique key missing`,
        );
      const [checks] = await connection.execute(
        "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=? AND CONSTRAINT_TYPE='CHECK'",
        ["attendease"],
      );
      assert.ok(checks.some((r) => r.CONSTRAINT_NAME === "chk_period"));
      console.log(
        "Verified all five foreign keys, cascade rules, composite/unique constraints, and period CHECK.",
      );
      console.log("Connection and schema checks passed.");
    } else throw Error("Use setup, seed or check.");
  }
} catch (error) {
  console.error(
    error.code
      ? `Database command failed (${error.code}). Check local credentials, privileges, and MySQL service.`
      : error.message,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
