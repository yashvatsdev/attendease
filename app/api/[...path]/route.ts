import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ZodError } from "zod";
import { pool, rows } from "@/lib/db";
import {
  idSchema,
  studentSchema,
  subjectSchema,
  enrollmentSchema,
  sessionSchema,
  attendanceSchema,
  validateRoster,
} from "@/lib/validation";
import { reportQuery } from "@/lib/reports";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const origin = req.headers.get("origin");
    if (!["GET", "HEAD"].includes(req.method) && origin) {
      // Next's internal URL may use localhost while the browser uses 127.0.0.1.
      // The incoming Host preserves the address actually requested by the browser.
      let sameOrigin = false;
      try {
        const source = new URL(origin);
        sameOrigin =
          source.host === req.headers.get("host") &&
          source.protocol === req.nextUrl.protocol;
      } catch {
        /* Invalid origins are rejected. */
      }
      if (!sameOrigin)
        throw new HttpError(403, "Cross-origin changes are not allowed.");
    }
    const { path } = await context.params;
    const [resource, rawId] = path;
    if (path.length > 2) throw new HttpError(404, "Endpoint not found.");
    const method = req.method;
    const id = rawId ? idSchema.parse(rawId) : undefined;
    const q = req.nextUrl.searchParams;
    const json = (value: unknown, status = 200) =>
      NextResponse.json(value, { status });
    if (resource === "health" && method === "GET") {
      await rows("SELECT 1");
      return json({ connected: true });
    }
    if (["students", "subjects"].includes(resource)) {
      const table = resource;
      const isStudent = table === "students";
      if (method === "GET") {
        if (id) {
          const items = await rows(`SELECT * FROM ${table} WHERE id=?`, [id]);
          if (!items.length) throw new HttpError(404, "Record not found.");
          const related = isStudent
            ? await rows(
                "SELECT sub.*,e.student_id IS NOT NULL enrolled FROM subjects sub LEFT JOIN enrollments e ON e.subject_id=sub.id AND e.student_id=? ORDER BY sub.code",
                [id],
              )
            : await rows(
                "SELECT s.*,e.subject_id IS NOT NULL enrolled FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.subject_id=? ORDER BY s.roll_no",
                [id],
              );
          return json({ ...items[0], related });
        }
        const search = q.get("search") || "";
        return json(
          isStudent
            ? await rows(
                "SELECT s.*,COUNT(e.subject_id) enrollment_count FROM students s LEFT JOIN enrollments e ON e.student_id=s.id WHERE s.name LIKE ? OR s.roll_no LIKE ? GROUP BY s.id ORDER BY s.roll_no",
                [`%${search}%`, `%${search}%`],
              )
            : await rows(
                "SELECT sub.*,COUNT(e.student_id) enrollment_count FROM subjects sub LEFT JOIN enrollments e ON e.subject_id=sub.id GROUP BY sub.id ORDER BY sub.code",
              ),
        );
      }
      if (method === "POST" || method === "PUT") {
        if (method === "PUT" && !id)
          throw new HttpError(400, "An ID is required.");
        const data = (isStudent ? studentSchema : subjectSchema).parse(
          await req.json(),
        );
        const columns = isStudent
          ? ["roll_no", "name", "email"]
          : ["code", "name"];
        const vals = columns.map(
          (k) => (data as Record<string, string | null>)[k] ?? null,
        );
        const [result] = await pool().execute<ResultSetHeader>(
          method === "POST"
            ? `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`
            : `UPDATE ${table} SET ${columns.map((c) => c + "=?").join(",")} WHERE id=?`,
          method === "POST" ? vals : [...vals, id!],
        );
        if (method === "PUT" && !result.affectedRows)
          throw new HttpError(404, "Record not found.");
        return json(
          { id: id || result.insertId },
          method === "POST" ? 201 : 200,
        );
      }
      if (method === "DELETE" && id) {
        const [r] = await pool().execute<ResultSetHeader>(
          `DELETE FROM ${table} WHERE id=?`,
          [id],
        );
        if (!r.affectedRows) throw new HttpError(404, "Record not found.");
        return json({ deleted: true });
      }
    }
    if (resource === "enrollments" && ["POST", "DELETE"].includes(method)) {
      const data = enrollmentSchema.parse(await req.json());
      const conn = await pool().getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute("SELECT id FROM subjects WHERE id=? FOR UPDATE", [
          data.subject_id,
        ]);
        if (method === "POST")
          await conn.execute(
            "INSERT INTO enrollments(student_id,subject_id) VALUES (?,?)",
            [data.student_id, data.subject_id],
          );
        else
          await conn.execute(
            "DELETE FROM enrollments WHERE student_id=? AND subject_id=?",
            [data.student_id, data.subject_id],
          );
        await conn.commit();
        return json({ saved: true }, method === "POST" ? 201 : 200);
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
    if (resource === "sessions" && method === "GET") {
      if (q.has("subject_id") && q.has("session_date")) {
        const key = sessionSchema.parse(Object.fromEntries(q));
        const sessions = await rows<{ id: number }>(
          "SELECT * FROM class_sessions WHERE subject_id=? AND session_date=? AND period_no=?",
          [key.subject_id, key.session_date, key.period_no],
        );
        const session = sessions[0];
        const roster = await rows(
          "SELECT s.id,s.roll_no,s.name,a.status FROM enrollments e JOIN students s ON s.id=e.student_id LEFT JOIN attendance a ON a.student_id=s.id AND a.session_id=? WHERE e.subject_id=? ORDER BY s.roll_no",
          [session?.id || 0, key.subject_id],
        );
        return json({ session: session || null, students: roster });
      }
      return json(
        await rows(
          "SELECT cs.*,sub.code,sub.name,COUNT(a.id) total,COALESCE(SUM(a.status='Present'),0) present FROM class_sessions cs JOIN subjects sub ON sub.id=cs.subject_id LEFT JOIN attendance a ON a.session_id=cs.id GROUP BY cs.id ORDER BY cs.session_date DESC,cs.period_no DESC LIMIT 50",
        ),
      );
    }
    if (resource === "attendance" && ["POST", "PUT"].includes(method)) {
      const data = attendanceSchema.parse(await req.json());
      if (method === "PUT" && !data.session_id)
        throw new HttpError(400, "Session ID is required for editing.");
      const conn = await pool().getConnection();
      try {
        await conn.beginTransaction();
        const [subjects] = await conn.execute<RowDataPacket[]>(
          "SELECT id FROM subjects WHERE id=? FOR UPDATE",
          [data.subject_id],
        );
        if (!subjects.length) throw new HttpError(404, "Subject not found.");
        const [enrolled] = await conn.execute<RowDataPacket[]>(
          "SELECT student_id FROM enrollments WHERE subject_id=? FOR UPDATE",
          [data.subject_id],
        );
        try {
          validateRoster(
            enrolled.map((r) => r.student_id),
            data.records.map((r) => r.student_id),
          );
        } catch (e) {
          throw new HttpError(422, (e as Error).message);
        }
        let sessionId = data.session_id;
        if (method === "POST") {
          const [r] = await conn.execute<ResultSetHeader>(
            "INSERT INTO class_sessions(subject_id,session_date,period_no) VALUES (?,?,?)",
            [data.subject_id, data.session_date, data.period_no],
          );
          sessionId = r.insertId;
        } else {
          const [existing] = await conn.execute<RowDataPacket[]>(
            "SELECT id FROM class_sessions WHERE id=? AND subject_id=? AND session_date=? AND period_no=? FOR UPDATE",
            [sessionId!, data.subject_id, data.session_date, data.period_no],
          );
          if (!existing.length)
            throw new HttpError(
              404,
              "Session does not match the selected subject, date and period.",
            );
        }
        for (const record of data.records)
          await conn.execute(
            method === "POST"
              ? "INSERT INTO attendance(session_id,student_id,status) VALUES (?,?,?)"
              : "INSERT INTO attendance(session_id,student_id,status) VALUES (?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)",
            [sessionId!, record.student_id, record.status],
          );
        await conn.commit();
        return json(
          { id: sessionId, saved: true },
          method === "POST" ? 201 : 200,
        );
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
    if (resource === "reports" && method === "GET") {
      const query = reportQuery(
        q.has("student_id") ? idSchema.parse(q.get("student_id")) : undefined,
        q.has("subject_id") ? idSchema.parse(q.get("subject_id")) : undefined,
      );
      const group = q.get("group");
      if (group === "students" || group === "subjects") {
        const columns =
          group === "students"
            ? "student_id,roll_no,name"
            : "subject_id,code,subject_name";
        return json(
          await rows(
            `SELECT ${columns},SUM(total) total,SUM(present) present,SUM(absent) absent,ROUND(100.0*SUM(present)/NULLIF(SUM(total),0),1) percentage FROM (${query.sql}) report GROUP BY ${columns} ${q.get("below") === "true" ? "HAVING percentage<75" : ""}`,
            query.values,
          ),
        );
      }
      return json(
        await rows(
          q.get("below") === "true"
            ? `SELECT * FROM (${query.sql}) report WHERE percentage<75`
            : query.sql,
          query.values,
        ),
      );
    }
    if (resource === "dashboard" && method === "GET") {
      const [stats] = await rows(
        `SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM subjects) subjects,(SELECT COUNT(*) FROM class_sessions) sessions,(SELECT ROUND(100.0*SUM(status='Present')/NULLIF(COUNT(*),0),1) FROM attendance) percentage`,
      );
      const subjects = await rows(
        "SELECT sub.id,sub.code,sub.name,COUNT(a.id) total,ROUND(100.0*SUM(a.status='Present')/NULLIF(COUNT(a.id),0),1) percentage FROM subjects sub LEFT JOIN class_sessions cs ON cs.subject_id=sub.id LEFT JOIN attendance a ON a.session_id=cs.id GROUP BY sub.id ORDER BY sub.code",
      );
      const recent = await rows(
        "SELECT cs.*,sub.code,sub.name,COUNT(a.id) total,COALESCE(SUM(a.status='Present'),0) present FROM class_sessions cs JOIN subjects sub ON sub.id=cs.subject_id LEFT JOIN attendance a ON a.session_id=cs.id GROUP BY cs.id ORDER BY cs.session_date DESC,cs.period_no DESC LIMIT 5",
      );
      const atRisk = await rows(
        "SELECT s.id,s.name,s.roll_no,COUNT(a.id) total,ROUND(100.0*SUM(a.status='Present')/COUNT(a.id),1) percentage FROM students s JOIN attendance a ON a.student_id=s.id GROUP BY s.id HAVING percentage<75 ORDER BY percentage,s.roll_no",
      );
      return json({ stats, subjects, recent, atRisk });
    }
    throw new HttpError(405, "This endpoint does not support that action.");
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 422 },
      );
    if (e instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    const code = (e as { code?: string }).code;
    if (code === "ER_DUP_ENTRY")
      return NextResponse.json(
        {
          error:
            "This record already exists. For attendance, load the existing session to edit it.",
        },
        { status: 409 },
      );
    if (code === "ER_NO_REFERENCED_ROW_2")
      return NextResponse.json(
        { error: "The selected student or subject no longer exists." },
        { status: 422 },
      );
    if (code === "ER_ROW_IS_REFERENCED_2")
      return NextResponse.json(
        { error: "This record is still referenced by other data." },
        { status: 409 },
      );
    return NextResponse.json(
      {
        error:
          "Database unavailable. Configure .env.local and run database setup, then retry.",
      },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
