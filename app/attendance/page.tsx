"use client";
import { useState } from "react";
import { CalendarCheck, Check, Save } from "lucide-react";
import { api, useData, ErrorMessage, Empty, Loading } from "@/components/ui";
import type { Subject, Session } from "@/lib/types";
type Roster = {
  session: Session | null;
  students: {
    id: number;
    roll_no: string;
    name: string;
    status: "Present" | "Absent" | null;
  }[];
};
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export default function AttendancePage() {
  const { data: subjects, error: subjectError } =
    useData<Subject[]>("subjects");
  const { data: sessions, reload } = useData<Session[]>("sessions");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState("1");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(s = subject, d = date, p = period) {
    setError("");
    setSuccess("");
    setRoster(null);
    setBusy(true);
    try {
      setRoster(
        await api<Roster>(
          `sessions?subject_id=${s}&session_date=${d}&period_no=${p}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function invalidate() {
    setRoster(null);
    setSuccess("");
    setError("");
  }
  const marked = roster?.students.filter((s) => s.status).length || 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE EVERY CLASS COUNT</div>
          <h1>
            Mark attendance<span className="green">.</span>
          </h1>
          <p>A subject, a session, and a complete record of who was there.</p>
        </div>
        <span className="badge">
          <CalendarCheck size={15} /> Classroom register
        </span>
      </div>
      <ErrorMessage message={subjectError || error} />
      {success && (
        <div className="notice success" role="status">
          <Check size={18} />
          {success}
        </div>
      )}
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Choose your session</h2>
            <p>
              Existing attendance loads automatically so you can make
              corrections.
            </p>
          </div>
        </div>
        <form
          className="session-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            Subject
            <select
              required
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                invalidate();
              }}
            >
              <option value="">Select a subject</option>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                invalidate();
              }}
            />
          </label>
          <label>
            Period
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                invalidate();
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Period {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button className="button" disabled={busy || !subject}>
            {busy ? "Loading…" : "Load register"}
          </button>
        </form>
      </section>
      {busy && !roster && <Loading />}
      {roster && (
        <section className="card register">
          <div className="section-heading">
            <div>
              <h2>
                {roster.session ? "Edit saved attendance" : "Class register"}{" "}
                <span className="inline-count">{roster.students.length}</span>
              </h2>
              <p>
                {marked} of {roster.students.length} students marked · {date} ·
                Period {period}
              </p>
            </div>
            {roster.students.length > 0 && (
              <button
                className="button secondary"
                onClick={() =>
                  setRoster({
                    ...roster,
                    students: roster.students.map((s) => ({
                      ...s,
                      status: "Present",
                    })),
                  })
                }
              >
                Mark all present
              </button>
            )}
          </div>
          {roster.students.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll number</th>
                      <th>Attendance status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.students.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td className="code">{s.roll_no}</td>
                        <td>
                          <div
                            className="status-toggle"
                            role="group"
                            aria-label={`Attendance for ${s.name}`}
                          >
                            {(["Present", "Absent"] as const).map((status) => (
                              <button
                                key={status}
                                aria-pressed={s.status === status}
                                className={
                                  s.status === status
                                    ? status.toLowerCase()
                                    : ""
                                }
                                onClick={() =>
                                  setRoster({
                                    ...roster,
                                    students: roster.students.map((row) =>
                                      row.id === s.id
                                        ? { ...row, status }
                                        : row,
                                    ),
                                  })
                                }
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="register-footer">
                <span>
                  {marked === roster.students.length
                    ? "Your register is complete and ready to save."
                    : "Mark every student to complete this session."}
                </span>
                <button
                  className="button"
                  disabled={busy || marked !== roster.students.length}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    setSuccess("");
                    try {
                      const result = await api<{ id: number }>(
                        "attendance",
                        roster.session ? "PUT" : "POST",
                        {
                          subject_id: Number(subject),
                          session_date: date,
                          period_no: Number(period),
                          session_id: roster.session?.id,
                          records: roster.students.map((s) => ({
                            student_id: s.id,
                            status: s.status,
                          })),
                        },
                      );
                      setRoster({
                        ...roster,
                        session: {
                          ...roster.session,
                          id: result.id,
                          subject_id: Number(subject),
                          session_date: date,
                          period_no: Number(period),
                        } as Session,
                      });
                      setSuccess(
                        "Attendance saved successfully. Every student record is stored in MySQL.",
                      );
                      reload();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Save size={16} />
                  {busy
                    ? "Saving…"
                    : roster.session
                      ? "Save corrections"
                      : "Save attendance"}
                </button>
              </div>
            </>
          ) : (
            <Empty>
              No students enrolled. Open Subjects to enroll students before
              marking attendance.
            </Empty>
          )}
        </section>
      )}
      <section className="card recent-card">
        <div className="section-heading">
          <div>
            <h2>Recorded sessions</h2>
            <p>Open a register to review or edit its attendance.</p>
          </div>
        </div>
        {sessions?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Present / total</th>
                  <th>Register</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>{s.code}</small>
                    </td>
                    <td>{s.session_date}</td>
                    <td>{s.period_no}</td>
                    <td>
                      {s.present} / {s.total}
                    </td>
                    <td>
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => {
                          setSubject(String(s.subject_id));
                          setDate(s.session_date);
                          setPeriod(String(s.period_no));
                          void load(
                            String(s.subject_id),
                            s.session_date,
                            String(s.period_no),
                          );
                        }}
                      >
                        Open register →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No recorded sessions yet.</Empty>
        )}
      </section>
    </>
  );
}
