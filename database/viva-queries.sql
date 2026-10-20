USE attendease;
-- 1. SELECT; 9. ORDER BY
SELECT id,roll_no,name,email,created_at FROM students ORDER BY roll_no;

-- 2, 3, 4. INSERT / UPDATE / DELETE: a new demonstration row, rolled back.
-- Stop on any SQL error. No existing student is modified.
START TRANSACTION;
SET @viva_roll=CONCAT('VIVA-',LEFT(REPLACE(UUID(),'-',''),15));
INSERT INTO students(roll_no,name,email) VALUES(@viva_roll,'Viva Demonstration Student',NULL);
SET @viva_student_id=LAST_INSERT_ID();
UPDATE students SET name='Updated Viva Student' WHERE id=@viva_student_id;
SELECT * FROM students WHERE id=@viva_student_id;
DELETE FROM students WHERE id=@viva_student_id;
ROLLBACK;

-- 5. INNER JOIN through the enrollment junction table.
SELECT s.roll_no,s.name,sub.code,sub.name AS subject_name
FROM students s INNER JOIN enrollments e ON e.student_id=s.id
INNER JOIN subjects sub ON sub.id=e.subject_id ORDER BY s.roll_no,sub.code;

-- 6. LEFT JOIN retains students with no enrollments.
SELECT s.roll_no,s.name,COUNT(e.subject_id) AS enrolled_subjects
FROM students s LEFT JOIN enrollments e ON e.student_id=s.id GROUP BY s.id;

-- 7, 8. GROUP BY, COUNT and SUM per subject.
SELECT sub.code,COUNT(a.id) recorded,COALESCE(SUM(a.status='Present'),0) present,
COALESCE(SUM(a.status='Absent'),0) absent
FROM subjects sub LEFT JOIN class_sessions cs ON cs.subject_id=sub.id
LEFT JOIN attendance a ON a.session_id=cs.id GROUP BY sub.id ORDER BY sub.code;

-- 10. Subquery: students enrolled in DBMS demo subject.
SELECT roll_no,name FROM students WHERE id IN
(SELECT student_id FROM enrollments WHERE subject_id IN
 (SELECT id FROM subjects WHERE code='DEMO-DBMS'));

-- 11. Weighted attendance; NULL means no records.
SELECT COUNT(*) recorded,SUM(status='Present') present,
ROUND(100.0*SUM(status='Present')/NULLIF(COUNT(*),0),1) percentage FROM attendance;

-- 12. Students below 75%; zero records are not classified as at risk.
SELECT s.roll_no,s.name,COUNT(a.id) recorded,
ROUND(100.0*SUM(a.status='Present')/NULLIF(COUNT(a.id),0),1) percentage
FROM students s LEFT JOIN attendance a ON a.student_id=s.id
GROUP BY s.id HAVING percentage<75 ORDER BY percentage;

-- Workbench demonstration: inspect recently created records.
SELECT * FROM students ORDER BY id DESC LIMIT 5;
SELECT s.roll_no,sub.code,cs.session_date,cs.period_no,a.status
FROM attendance a JOIN students s ON s.id=a.student_id
JOIN class_sessions cs ON cs.id=a.session_id JOIN subjects sub ON sub.id=cs.subject_id
ORDER BY cs.session_date DESC,cs.id DESC,s.roll_no LIMIT 30;
