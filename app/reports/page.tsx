"use client";
import { useState } from "react";
import {
  useData,
  ErrorMessage,
  Loading,
  Empty,
  Progress,
} from "@/components/ui";
import type { Student, Subject, Report } from "@/lib/types";
export default function ReportsPage() {
  const [student, setStudent] = useState("");
  const [subject, setSubject] = useState("");
  const [below, setBelow] = useState(false);
  const [group, setGroup] = useState("details");
  const { data: students, error: studentError } =
    useData<Student[]>("students");
  const { data: subjects, error: subjectError } =
    useData<Subject[]>("subjects");
  const params = new URLSearchParams({ group, below: String(below) });
  if (student) params.set("student_id", student);
  if (subject) params.set("subject_id", subject);
  const { data, error } = useData<Report[]>(`reports?${params}`);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TURN RECORDS INTO PERSPECTIVE</div>
          <h1>
            Attendance reports<span className="green">.</span>
          </h1>
          <p>Follow each student’s progress, one subject at a time.</p>
        </div>
        <span className="badge">75% recommended minimum</span>
      </div>
      <ErrorMessage message={error || studentError || subjectError} />
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>A closer look</h2>
            <p>
              Percentages use recorded attendance. Unrecorded classes are never
              counted as absences.
            </p>
          </div>
          <div className="status-toggle" role="group" aria-label="Report view">
            {[
              ["details", "Detailed"],
              ["students", "By student"],
              ["subjects", "By subject"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={group === value}
                className={group === value ? "present" : ""}
                onClick={() => setGroup(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="report-filters">
          <label>
            Student
            <select
              value={student}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="">All students</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_no} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">All subjects</option>
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={below}
              onChange={(e) => setBelow(e.target.checked)}
            />
            Only below 75%
          </label>
          <button
            className="button secondary"
            onClick={() => {
              setStudent("");
              setSubject("");
              setBelow(false);
            }}
          >
            Reset filters
          </button>
        </div>
        {!data && !error ? (
          <Loading />
        ) : data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {group !== "subjects" && <th>Student</th>}
                  {group !== "students" && <th>Subject</th>}
                  <th>Recorded</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={`${r.student_id || ""}-${r.subject_id || ""}`}>
                    {group !== "subjects" && (
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.roll_no}</small>
                      </td>
                    )}
                    {group !== "students" && (
                      <td>
                        <strong>{r.subject_name}</strong>
                        <small>{r.code}</small>
                      </td>
                    )}
                    <td>{r.total}</td>
                    <td>
                      <span className="green">{r.present}</span>
                    </td>
                    <td>{r.absent}</td>
                    <td>
                      <Progress value={r.percentage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No attendance records match these filters. Students with no records
            show “No records” rather than 0%.
          </Empty>
        )}
        <div className="table-note">
          {data?.length || 0}{" "}
          {group === "details"
            ? "student–subject"
            : group === "students"
              ? "student"
              : "subject"}{" "}
          records · Calculated in MySQL · Attendance = present ÷ recorded × 100
        </div>
      </section>
    </>
  );
}
