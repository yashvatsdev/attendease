"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  ChartNoAxesCombined,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useData,
  ErrorMessage,
  Loading,
  Empty,
  Progress,
} from "@/components/ui";
import type { Dashboard } from "@/lib/types";
export default function DashboardPage() {
  const { data, error, reload } = useData<Dashboard>("dashboard");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE AT A GLANCE</div>
          <h1>
            A clear view of every class<span className="green">.</span>
          </h1>
          <p>
            Track participation, spot gaps, and keep your students on course.
          </p>
        </div>
        <Link className="button" href="/attendance">
          <CalendarCheck size={17} />
          Mark attendance
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <ErrorMessage message={error} />
      {error && (
        <button className="button secondary" onClick={reload}>
          Retry connection
        </button>
      )}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="stat-grid">
            {[
              [
                Users,
                "Total students",
                data.stats.students,
                "Across your college",
              ],
              [
                BookOpen,
                "Active subjects",
                data.stats.subjects,
                "Ready for attendance",
              ],
              [
                ChartNoAxesCombined,
                "Overall attendance",
                data.stats.percentage === null
                  ? "—"
                  : `${data.stats.percentage}%`,
                "All recorded attendance",
              ],
              [
                CalendarCheck,
                "Class sessions",
                data.stats.sessions,
                "Recorded and saved",
              ],
            ].map(([Icon, label, value, note]) => {
              const I = Icon as typeof Users;
              return (
                <article className="stat-card" key={String(label)}>
                  <div className="stat-top">
                    <span>{String(label)}</span>
                    <span className="stat-icon">
                      <I size={19} />
                    </span>
                  </div>
                  <strong>{String(value)}</strong>
                  <small>{String(note)}</small>
                </article>
              );
            })}
          </div>
          <div className="dashboard-grid">
            <section className="card chart-card">
              <div className="section-heading">
                <div>
                  <h2>Attendance by subject</h2>
                  <p>A little perspective on classroom participation.</p>
                </div>
                <span className="badge">All sessions</span>
              </div>
              {data.subjects.some((s) => s.total > 0) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.subjects}
                      margin={{ top: 20, right: 10, bottom: 10, left: -15 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="#E2E8E0"
                        strokeDasharray="3 5"
                      />
                      <XAxis
                        dataKey="code"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#64748B" }}
                        tickFormatter={(s) => s.replace("DEMO-", "")}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Attendance"]}
                        cursor={{ fill: "#F0F7F0" }}
                      />
                      <Bar
                        dataKey="percentage"
                        fill="#166534"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={48}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty>
                  Subject attendance will appear after your first saved session.
                </Empty>
              )}
              <div className="chart-legend">
                <span />
                Present attendance <span className="muted-dot" />
                75% attendance is the recommended minimum
              </div>
            </section>
            <section className="card attention-card">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">STAY ONE STEP AHEAD</div>
                  <h2>Students to check in with</h2>
                  <p>Overall attendance below 75%.</p>
                </div>
                <span className="count-badge">{data.atRisk.length}</span>
              </div>
              {data.atRisk.length ? (
                <div className="risk-list">
                  {data.atRisk.slice(0, 5).map((s) => (
                    <div className="risk-row" key={s.id}>
                      <span className="avatar">
                        {s.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.roll_no}</small>
                      </div>
                      <span className="badge warning">{s.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No students with recorded attendance below 75%.</Empty>
              )}
              <Link href="/reports" className="text-link">
                View attendance reports <ArrowRight size={16} />
              </Link>
            </section>
            <section className="card recent-card">
              <div className="section-heading">
                <div>
                  <h2>Recently recorded</h2>
                  <p>Your latest classroom attendance, in one place.</p>
                </div>
                <Link className="text-link" href="/attendance">
                  View sessions <ArrowUpRight size={16} />
                </Link>
              </div>
              {data.recent.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Session date</th>
                        <th>Period</th>
                        <th>Present / total</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.name}</strong>
                            <small>{s.code}</small>
                          </td>
                          <td>{s.session_date}</td>
                          <td>
                            <span className="badge">Period {s.period_no}</span>
                          </td>
                          <td>
                            {s.present} / {s.total}
                          </td>
                          <td>
                            <Progress
                              value={
                                s.total
                                  ? Math.round((s.present / s.total) * 100)
                                  : null
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>
                  No sessions yet. Mark your first class to get started.
                </Empty>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
