import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

dotenv.config({ path: ".env.local", quiet: true });
const output = resolve("docs/diagrams");
const order = [
  "students",
  "subjects",
  "enrollments",
  "class_sessions",
  "attendance",
];
const ddl = await readFile("database/schema.sql", "utf8");
const cleanType = (value) => value.toLowerCase().replaceAll(" ", "");
const names = (value) =>
  value
    .replaceAll("`", "")
    .split(",")
    .map((v) => v.trim());
let connection;
let browser;

try {
  await mkdir(output, { recursive: true });
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "attendease",
    dateStrings: true,
  });
  // Metadata reads only: no setup, seed, DDL or data mutations are executed.
  const [tables] = await connection.execute(
    "SELECT TABLE_NAME,ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=? ORDER BY TABLE_NAME",
    ["attendease", "BASE TABLE"],
  );
  assert.deepEqual(tables.map((t) => t.TABLE_NAME).sort(), [...order].sort());
  const snapshot = {
    database: "attendease",
    verifiedAt: new Date().toISOString(),
    schemaFileSha256: createHash("sha256").update(ddl).digest("hex"),
    tables: [],
  };
  const creates = [];
  for (const name of order) {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
      ["attendease", name],
    );
    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME,NON_UNIQUE,COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY INDEX_NAME,SEQ_IN_INDEX",
      ["attendease", name],
    );
    const [foreignKeys] = await connection.execute(
      "SELECT k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.DELETE_RULE,r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=? AND k.TABLE_NAME=? ORDER BY k.COLUMN_NAME",
      ["attendease", name],
    );
    const [checks] = await connection.execute(
      "SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=? AND tc.TABLE_NAME=? AND tc.CONSTRAINT_TYPE='CHECK'",
      ["attendease", name],
    );
    const [create] = await connection.query(`SHOW CREATE TABLE \`${name}\``);
    creates.push(
      create[0]["Create Table"].replace(/ AUTO_INCREMENT=\d+/g, "") + ";",
    );
    const body = ddl.match(
      new RegExp(
        `CREATE TABLE IF NOT EXISTS ${name}\\s*\\(([\\s\\S]*?)\\) ENGINE=InnoDB;`,
        "i",
      ),
    )?.[1];
    assert.ok(body, `${name} missing in schema.sql`);
    const primary = body.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
    const fileColumns = [
      ...body.matchAll(
        /^\s*(\w+)\s+(INT|VARCHAR\(\d+\)|TIMESTAMP|DATE|ENUM\([^)]+\))\s*([^\r\n]*)/gim,
      ),
    ];
    assert.equal(columns.length, fileColumns.length, `${name} column count`);
    for (const [i, [, columnName, type, rest]] of fileColumns.entries()) {
      const actual = columns[i];
      assert.equal(actual.COLUMN_NAME, columnName);
      assert.equal(
        cleanType(actual.COLUMN_TYPE),
        cleanType(type),
        `${name}.${columnName} type`,
      );
      const isPk =
        /PRIMARY KEY/i.test(rest) ||
        Boolean(primary && names(primary[1]).includes(columnName));
      assert.equal(
        actual.IS_NULLABLE === "NO",
        /NOT NULL/i.test(rest) || isPk,
        `${name}.${columnName} nullability`,
      );
      assert.equal(
        actual.EXTRA.includes("auto_increment"),
        /AUTO_INCREMENT/i.test(rest),
      );
      if (/DEFAULT CURRENT_TIMESTAMP/i.test(rest))
        assert.match(actual.COLUMN_DEFAULT, /^CURRENT_TIMESTAMP(?:\(\))?$/i);
      else assert.equal(actual.COLUMN_DEFAULT, null);
    }
    const expectedPk = primary
      ? names(primary[1])
      : fileColumns.filter((c) => /PRIMARY KEY/i.test(c[3])).map((c) => c[1]);
    assert.deepEqual(
      indexes
        .filter((i) => i.INDEX_NAME === "PRIMARY")
        .map((i) => i.COLUMN_NAME),
      expectedPk,
    );
    const expectedUnique = fileColumns
      .filter((c) => /UNIQUE/i.test(c[3]))
      .map((c) => [c[1]]);
    for (const match of body.matchAll(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi))
      expectedUnique.push(names(match[1]));
    const indexNames = [
      ...new Set(
        indexes
          .filter((i) => !i.NON_UNIQUE && i.INDEX_NAME !== "PRIMARY")
          .map((i) => i.INDEX_NAME),
      ),
    ];
    const unique = indexNames.map((key) =>
      indexes.filter((i) => i.INDEX_NAME === key).map((i) => i.COLUMN_NAME),
    );
    assert.deepEqual(
      unique.map((v) => v.join(",")).sort(),
      expectedUnique.map((v) => v.join(",")).sort(),
    );
    for (const match of body.matchAll(/INDEX\s+(\w+)\s*\(([^)]+)\)/gi))
      assert.deepEqual(
        indexes
          .filter((i) => i.INDEX_NAME === match[1])
          .map((i) => i.COLUMN_NAME),
        names(match[2]),
      );
    const expectedFk = [
      ...body.matchAll(
        /FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\((\w+)\)\s*ON DELETE (\w+)/gi,
      ),
    ]
      .map((m) => [m[1], m[2], m[3], m[4].toUpperCase()].join(":"))
      .sort();
    assert.deepEqual(
      foreignKeys
        .map((f) =>
          [
            f.COLUMN_NAME,
            f.REFERENCED_TABLE_NAME,
            f.REFERENCED_COLUMN_NAME,
            f.DELETE_RULE,
          ].join(":"),
        )
        .sort(),
      expectedFk,
    );
    assert.ok(
      foreignKeys.every(
        (f) => f.UPDATE_RULE === "NO ACTION" || f.UPDATE_RULE === "RESTRICT",
      ),
    );
    assert.equal(checks.length, (body.match(/\bCHECK\s*\(/gi) || []).length);
    if (name === "class_sessions")
      assert.match(
        checks[0].CHECK_CLAUSE.replaceAll("`", ""),
        /period_no between 1 and 12/i,
      );
    assert.equal(tables.find((t) => t.TABLE_NAME === name).ENGINE, "InnoDB");
    snapshot.tables.push({
      name,
      engine: "InnoDB",
      columns,
      indexes,
      foreignKeys,
      checks,
    });
  }
  await connection.end();
  connection = null;
  await writeFile(
    resolve(output, "schema-verification.json"),
    JSON.stringify(snapshot, null, 2) + "\n",
  );
  await writeFile(
    resolve(output, "attendease-schema.sql"),
    "-- Read-only snapshot of live SHOW CREATE TABLE output.\n-- For offline Workbench import; this file has not been executed.\nCREATE DATABASE IF NOT EXISTS attendease;\nUSE attendease;\n\n" +
      creates.join("\n\n") +
      "\n",
  );

  const labels = {
    "enrollments.student_id": "has enrollments",
    "enrollments.subject_id": "has enrollments",
    "class_sessions.subject_id": "schedules",
    "attendance.session_id": "has records",
    "attendance.student_id": "has attendance",
  };
  let source = "erDiagram\n    direction TB\n";
  for (const table of snapshot.tables) {
    source += `    ${table.name} {\n`;
    for (const column of table.columns) {
      const pk = table.indexes.some(
        (i) =>
          i.INDEX_NAME === "PRIMARY" && i.COLUMN_NAME === column.COLUMN_NAME,
      );
      const fk = table.foreignKeys.some(
        (f) => f.COLUMN_NAME === column.COLUMN_NAME,
      );
      const uk = table.indexes.some(
        (i) =>
          !i.NON_UNIQUE &&
          i.INDEX_NAME !== "PRIMARY" &&
          i.COLUMN_NAME === column.COLUMN_NAME &&
          table.indexes.filter((j) => j.INDEX_NAME === i.INDEX_NAME).length ===
            1,
      );
      const keys = [pk ? "PK" : "", fk ? "FK" : "", uk ? "UK" : ""].filter(
        Boolean,
      );
      const notes = [column.IS_NULLABLE === "NO" ? "NOT NULL" : "NULL allowed"];
      if (column.EXTRA.includes("auto_increment")) notes.push("AUTO_INCREMENT");
      if (column.COLUMN_DEFAULT)
        notes.push(`DEFAULT ${column.COLUMN_DEFAULT.toUpperCase()}`);
      if (column.COLUMN_TYPE.startsWith("enum"))
        notes.push(
          column.COLUMN_TYPE.slice(5, -1)
            .replaceAll("'", "")
            .replaceAll(",", " | "),
        );
      const type = column.COLUMN_TYPE.startsWith("enum")
        ? "ENUM"
        : column.COLUMN_TYPE.toUpperCase();
      source += `        ${type} ${column.COLUMN_NAME}${keys.length ? " " + keys.join(", ") : ""} "${notes.join("; ")}"\n`;
    }
    source += "    }\n";
  }
  for (const table of snapshot.tables)
    for (const fk of table.foreignKeys) {
      const identifying = table.indexes.some(
        (i) => i.INDEX_NAME === "PRIMARY" && i.COLUMN_NAME === fk.COLUMN_NAME,
      );
      source += `    ${fk.REFERENCED_TABLE_NAME} ||${identifying ? "--" : ".."}o{ ${table.name} : "${labels[`${table.name}.${fk.COLUMN_NAME}`]}"\n`;
    }
  assert.equal(
    snapshot.tables.reduce((sum, t) => sum + t.columns.length, 0),
    18,
  );
  assert.equal(
    snapshot.tables.reduce((sum, t) => sum + t.foreignKeys.length, 0),
    5,
  );
  await writeFile(resolve(output, "attendease-er.mmd"), source);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:white"></body></html>',
  );
  await page.addScriptTag({
    path: resolve("node_modules/mermaid/dist/mermaid.min.js"),
  });
  const rendered = await page.evaluate(async (source) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      layout: "dagre",
      fontFamily: "Arial, sans-serif",
      themeVariables: {
        primaryColor: "#F0F7F0",
        primaryTextColor: "#1F2937",
        primaryBorderColor: "#166534",
        lineColor: "#42634A",
        secondaryColor: "#FFFFFF",
        tertiaryColor: "#F8FAF7",
        fontSize: "16px",
      },
      er: {
        useMaxWidth: false,
        layoutDirection: "TB",
        entityPadding: 18,
        nodeSpacing: 80,
        rankSpacing: 90,
        minEntityWidth: 180,
        fontSize: 16,
      },
    });
    const result = await mermaid.render("attendease-er", source);
    document.body.innerHTML = result.svg;
    const svg = document.querySelector("svg");
    const view = svg.viewBox.baseVal;
    return {
      svg: svg.outerHTML,
      width: view.width,
      height: view.height,
      text: svg.textContent,
    };
  }, source);
  for (const table of snapshot.tables) {
    assert.ok(rendered.text.includes(table.name));
    for (const col of table.columns)
      assert.ok(rendered.text.includes(col.COLUMN_NAME));
  }
  const width = Math.ceil(Math.max(rendered.width + 96, 1200));
  const height = Math.ceil(rendered.height + 330);
  const diagramX = (width - rendered.width) / 2;
  const inner = rendered.svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="diagram-title diagram-desc">
  <title id="diagram-title">AttendEase — Physical Entity Relationship Diagram</title>
  <desc id="diagram-desc">Five verified MySQL tables, eighteen attributes, and five foreign key relationships. Identifying enrollment relationships are solid; other relationships are dashed. Every child references exactly one parent; parents may have zero or more children.</desc>
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <rect x="0" y="0" width="${width}" height="8" fill="#166534"/>
  <g font-family="Arial, sans-serif"><text x="48" y="49" font-size="12" font-weight="700" fill="#166534" letter-spacing="2">ATTENDEASE / DATABASE DESIGN</text>
  <text x="48" y="88" font-size="30" font-weight="700" fill="#1F2937">Student Attendance Management System</text>
  <text x="48" y="117" font-size="15" fill="#64748B">Physical ER diagram · MySQL 8 · InnoDB · 5 entities / 18 attributes / 5 foreign keys</text></g>
  <svg id="attendease-er" x="${diagramX}" y="150" width="${rendered.width}" height="${rendered.height}" viewBox="0 0 ${rendered.width} ${rendered.height}">${inner}</svg>
  <g font-family="Arial, sans-serif" font-size="14" fill="#1F2937" transform="translate(48,${height - 144})">
  <line x1="0" y1="0" x2="${width - 96}" y2="0" stroke="#E2E8E0"/>
  <text y="29" font-weight="700">KEYS &amp; CARDINALITY</text>
  <text y="54">PK  Primary key     FK  Foreign key     UK  Single-column unique key     ||  Exactly one     o{  Zero or more</text>
  <text y="79">Solid: identifying (FK in child PK). Dashed: non-identifying. All five FKs: ON DELETE CASCADE.</text>
  <text y="104">Composite uniqueness: enrollments(student_id, subject_id) [PK]; class_sessions(subject_id, session_date, period_no);</text>
  <text y="127">attendance(session_id, student_id). Period CHECK: 1–12. Verified against live attendease and database/schema.sql.</text></g></svg>`;
  await writeFile(resolve(output, "attendease-er.svg"), svg);
  await page.setViewportSize({ width, height });
  await page.setContent(svg);
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("body > svg")
    .screenshot({ path: resolve(output, "attendease-er.png") });
  const summary = {
    verified: true,
    tables: 5,
    columns: 18,
    foreignKeys: 5,
    identifyingRelationships: 2,
    nonIdentifyingRelationships: 3,
    svgDimensions: { width, height },
    pngDimensions: { width: width * 2, height: height * 2 },
    databaseChanged: false,
  };
  await writeFile(
    resolve(output, "verification-summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    "Generated PNG, SVG, Mermaid source, offline DDL, and live metadata verification files in docs/diagrams/.",
  );
} catch (error) {
  console.error(
    "ER generation failed:",
    error.code === "ERR_ASSERTION" ? error.stack : error.code || error.message,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
  if (browser) await browser.close();
}
