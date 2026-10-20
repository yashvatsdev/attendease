"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  Users,
  ArrowUpRight,
} from "lucide-react";
const nav = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/students", "Students", Users],
  ["/subjects", "Subjects", BookOpen],
  ["/attendance", "Attendance", CalendarCheck],
  ["/reports", "Reports", ChartNoAxesCombined],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <GraduationCap size={25} />
          </span>
          <span>
            Attend<span className="green">Ease</span>
            <small>STUDENT ATTENDANCE</small>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">AE</span>
          <div>
            College workspace<small>Attendance management</small>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {path === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <span className="eyebrow">A LITTLE CONSISTENCY</span>
            <h3>Every class counts.</h3>
            <p>
              Keep records clear.
              <br />
              Help students stay on track.
            </p>
            <Link href="/attendance">
              Mark attendance <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="local-label">
            <span />
            Local college workspace
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>
              {nav.find(([href]) => href === path)?.[1] || "AttendEase"}
            </strong>
          </span>
          <span className="top-tag">
            <GraduationCap size={16} /> Student Attendance System
          </span>
        </header>
        <main>{children}</main>
        <footer>
          AttendEase <span>Thoughtful records. Better attendance.</span>
          <span>DBMS practical project</span>
        </footer>
      </div>
    </div>
  );
}
