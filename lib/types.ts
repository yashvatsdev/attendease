export type Student = {
  id: number;
  roll_no: string;
  name: string;
  email: string | null;
  created_at: string;
  enrollment_count: number;
  enrolled?: number;
};
export type Subject = {
  id: number;
  code: string;
  name: string;
  enrollment_count: number;
  enrolled?: number;
};
export type Report = {
  student_id: number;
  roll_no: string;
  name: string;
  subject_id: number;
  code: string;
  subject_name: string;
  total: number;
  present: number;
  absent: number;
  percentage: number | null;
};
export type Session = {
  id: number;
  code: string;
  name: string;
  subject_id: number;
  session_date: string;
  period_no: number;
  total: number;
  present: number;
};
export type Dashboard = {
  stats: {
    students: number;
    subjects: number;
    sessions: number;
    percentage: number | null;
  };
  subjects: {
    id: number;
    code: string;
    name: string;
    total: number;
    percentage: number | null;
  }[];
  recent: Session[];
  atRisk: {
    id: number;
    name: string;
    roll_no: string;
    total: number;
    percentage: number;
  }[];
};
