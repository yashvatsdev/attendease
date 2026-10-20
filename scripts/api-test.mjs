import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const suffix = Date.now().toString(36);
let sid, other, sub;
let db;
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + "/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
try {
  await request("health");
  console.log("PASS database connection");
  const initial = await request("dashboard");
  sid = (
    await request(
      "students",
      "POST",
      {
        roll_no: "T" + suffix,
        name: "Integration Student",
        email: `${suffix}@example.com`,
      },
      201,
    )
  ).id;
  await request(`students/${sid}`, "PUT", {
    roll_no: "T" + suffix,
    name: "Updated Student",
    email: "",
  });
  assert.equal((await request(`students/${sid}`)).name, "Updated Student");
  console.log("PASS student create, edit and read");
  other = (
    await request(
      "students",
      "POST",
      { roll_no: "X" + suffix, name: "Outside Student", email: "" },
      201,
    )
  ).id;
  sub = (
    await request(
      "subjects",
      "POST",
      { code: "T" + suffix, name: "Integration Subject" },
      201,
    )
  ).id;
  await request(`subjects/${sub}`, "PUT", {
    code: "T" + suffix,
    name: "Updated Integration Subject",
  });
  assert.equal(
    (await request(`subjects/${sub}`)).name,
    "Updated Integration Subject",
  );
  await request(
    "enrollments",
    "POST",
    { student_id: sid, subject_id: sub },
    201,
  );
  await request(
    "enrollments",
    "POST",
    { student_id: sid, subject_id: sub },
    409,
  );
  console.log("PASS subject creation, enrollment, duplicate protection");
  const key = { subject_id: sub, session_date: "2026-10-20", period_no: 1 };
  const marked = await request(
    "attendance",
    "POST",
    { ...key, records: [{ student_id: sid, status: "Present" }] },
    201,
  );
  await request(
    "attendance",
    "POST",
    { ...key, records: [{ student_id: sid, status: "Present" }] },
    409,
  );
  await request(
    "attendance",
    "POST",
    {
      ...key,
      period_no: 2,
      records: [{ student_id: other, status: "Present" }],
    },
    422,
  );
  await request(
    "attendance",
    "POST",
    {
      ...key,
      period_no: 2,
      records: [
        { student_id: sid, status: "Present" },
        { student_id: sid, status: "Absent" },
      ],
    },
    422,
  );
  assert.equal(
    (
      await request(
        `sessions?subject_id=${sub}&session_date=2026-10-20&period_no=2`,
      )
    ).session,
    null,
  );
  console.log("PASS attendance save, duplicate and enrollment rejection");
  await request("attendance", "PUT", {
    ...key,
    session_id: marked.id,
    records: [{ student_id: sid, status: "Absent" }],
  });
  let report = await request(`reports?student_id=${sid}&subject_id=${sub}`);
  assert.equal(report[0].percentage, 0);
  assert.ok((await request("dashboard")).atRisk.some((s) => s.id === sid));
  await request(
    "attendance",
    "POST",
    { ...key, period_no: 2, records: [{ student_id: sid, status: "Present" }] },
    201,
  );
  report = await request(`reports?student_id=${sid}&subject_id=${sub}`);
  assert.equal(report[0].percentage, 50);
  assert.equal(report[0].present, 1);
  assert.equal(report[0].absent, 1);
  assert.equal(
    (await request(`reports?student_id=${sid}&group=students`))[0].percentage,
    50,
  );
  assert.equal(
    (await request(`reports?subject_id=${sub}&group=subjects`))[0].percentage,
    50,
  );
  assert.equal(
    (await request(`reports?subject_id=${sub}&below=true`)).length,
    1,
  );
  console.log("PASS attendance edit, SQL percentage, below-75% identification");
  await request(
    "enrollments",
    "POST",
    { student_id: other, subject_id: sub },
    201,
  );
  await request(
    "attendance",
    "POST",
    { ...key, period_no: 3, records: [{ student_id: sid, status: "Present" }] },
    422,
  );
  report = await request(`reports?student_id=${other}&subject_id=${sub}`);
  assert.equal(report[0].total, 0);
  assert.equal(report[0].percentage, null);
  console.log("PASS partial roster rejected and zero records handled");
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "attendease",
  });
  // Deliberately fail the second attendance insert after the first succeeds. Trigger affects only test subject.
  const trigger = `attendease_test_${suffix}`;
  try {
    await db.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON attendance FOR EACH ROW BEGIN IF NEW.student_id=${other} AND EXISTS(SELECT 1 FROM class_sessions WHERE id=NEW.session_id AND subject_id=${sub}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test rollback'; END IF; END`,
    );
    await request(
      "attendance",
      "POST",
      {
        ...key,
        period_no: 3,
        records: [
          { student_id: sid, status: "Present" },
          { student_id: other, status: "Absent" },
        ],
      },
      503,
    );
    const [r] = await db.execute(
      "SELECT id FROM class_sessions WHERE subject_id=? AND period_no=3",
      [sub],
    );
    assert.equal(r.length, 0);
    console.log(
      "PASS genuine mid-write SQL failure rolls back session and attendance",
    );
  } finally {
    await db.query(`DROP TRIGGER IF EXISTS ${trigger}`);
  }
  const stats = (await request("dashboard")).stats;
  assert.equal(stats.students, initial.stats.students + 2);
  assert.equal(stats.subjects, initial.stats.subjects + 1);
  assert.equal(stats.sessions, initial.stats.sessions + 2);
  const [direct] = await db.query(
    "SELECT ROUND(100.0*SUM(status='Present')/COUNT(*),1) percentage FROM attendance",
  );
  assert.equal(stats.percentage, Number(direct[0].percentage));
  console.log("PASS dashboard statistics match SQL");
  await request("enrollments", "DELETE", { student_id: sid, subject_id: sub });
  assert.equal(
    (await request(`reports?student_id=${sid}&subject_id=${sub}`))[0]
      .percentage,
    50,
  );
  console.log("PASS history survives unenrollment");
  console.log("ALL API INTEGRATION SCENARIOS PASSED");
} catch (e) {
  console.error(e.code ? `Database test failed (${e.code})` : e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
  if (sub) await request(`subjects/${sub}`, "DELETE");
  if (sid) await request(`students/${sid}`, "DELETE");
  if (other) await request(`students/${other}`, "DELETE");
  console.log("Temporary test records cleaned up.");
}
