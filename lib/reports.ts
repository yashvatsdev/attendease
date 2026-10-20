export function reportQuery(student?: number, subject?: number) {
  const conditions: string[] = [];
  const values: number[] = [];
  if (student) {
    conditions.push("s.id=?");
    values.push(student);
  }
  if (subject) {
    conditions.push("sub.id=?");
    values.push(subject);
  }
  // Historical records remain reportable after unenrollment; new enrollees start with zero records.
  return {
    sql: `SELECT s.id student_id,s.roll_no,s.name,sub.id subject_id,sub.code,sub.name subject_name,
 COUNT(a.id) total,COALESCE(SUM(a.status='Present'),0) present,COALESCE(SUM(a.status='Absent'),0) absent,
 ROUND(100.0*SUM(a.status='Present')/NULLIF(COUNT(a.id),0),1) percentage
 FROM (SELECT student_id,subject_id FROM enrollments UNION SELECT a.student_id,cs.subject_id FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id) pairs
 JOIN students s ON s.id=pairs.student_id JOIN subjects sub ON sub.id=pairs.subject_id
 LEFT JOIN class_sessions cs ON cs.subject_id=sub.id LEFT JOIN attendance a ON a.session_id=cs.id AND a.student_id=s.id
 ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
 GROUP BY s.id,sub.id ORDER BY s.roll_no,sub.code`,
    values,
  };
}
