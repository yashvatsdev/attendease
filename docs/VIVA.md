# AttendEase viva guide

## Five normalized tables

| Table          | Purpose                              | Key                                              |
| -------------- | ------------------------------------ | ------------------------------------------------ |
| students       | Student identity and contact details | id; unique roll_no and nullable unique email     |
| subjects       | Subject catalog                      | id; unique code                                  |
| enrollments    | Current subject membership           | Composite primary key (student_id, subject_id)   |
| class_sessions | Subject, date and period of a class  | id; unique (subject_id, session_date, period_no) |
| attendance     | Student status for a session         | id; unique (session_id, student_id)              |

## Keys and relationships

A primary key uniquely identifies a row and cannot be NULL. A foreign key references a parent row and prevents orphan records. A composite key combines columns: a student can join many subjects, but a student–subject pair appears once.

One student has many enrollments; one subject has many enrollments. These resolve the many-to-many student–subject relationship. One subject has many sessions. One session has many attendance records. One student has many attendance records.

Deleting a student cascades to their enrollments and attendance. Deleting a subject cascades to its enrollments, sessions, and those sessions' attendance. Unenrolling only deletes membership; historical attendance stays. Confirmation dialogs explain destructive effects.

## Normalization through 3NF

- **1NF:** Each field has one atomic value. Students do not store lists of subjects.
- **2NF:** The only composite primary key is in enrollments, which has no non-key attributes. Other entities have single-column primary keys.
- **3NF:** Student details belong to students, subject details to subjects, and session dates to class_sessions. Attendance does not duplicate names or subject metadata. Non-key attributes depend on the key without transitive dependencies.

## JOIN and GROUP BY

```sql
SELECT s.roll_no,s.name,sub.name subject
FROM students s
JOIN enrollments e ON e.student_id=s.id
JOIN subjects sub ON sub.id=e.subject_id;

SELECT s.id,s.name,COUNT(a.id) recorded,
       COALESCE(SUM(a.status='Present'),0) present,
       ROUND(100.0*SUM(a.status='Present')/NULLIF(COUNT(a.id),0),1) percentage
FROM students s LEFT JOIN attendance a ON a.student_id=s.id
GROUP BY s.id;
```

INNER JOIN returns matching rows. LEFT JOIN retains left-side rows with no match. COUNT(a.id) excludes NULL matches, important for zero attendance. GROUP BY forms one aggregate result per student.

## Constraints

PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK and ENUM guard identity, references and allowed values. Periods are restricted to 1–12. Unique constraints reject duplicate rolls, emails, subject codes, enrollments, sessions, and attendance pairs. Multiple NULL emails are allowed. Zod validates inputs; the attendance transaction also checks complete enrollment membership.

## Transactions and concurrency

Attendance saving begins an InnoDB transaction. SELECT … FOR UPDATE locks the subject row, serializing attendance writes and enrollment changes for that subject. The roster is checked for duplicates, outsiders and omissions. The session and all attendance records commit together. An error rolls everything back. Editing applies the same checks and updates statuses. Unique constraints provide a final duplicate defense.

ACID: atomicity means all records save together; consistency preserves constraints; isolation keeps competing transactions from corrupting each other; durability means committed data survives an application restart.

## Percentage calculation

Attendance = present records / recorded attendance records × 100. NULLIF prevents division by zero. No records is NULL and displays **No records**, not 0%, and is excluded from at-risk lists. Aggregate reports divide summed present counts by summed totals rather than averaging percentages. Enrollment does not create past absences; unenrollment keeps history. Membership changes do not rewrite old sessions.

## 15 likely questions

1. **Why MySQL?** Relational constraints, joins, aggregates and transactions fit this data.
2. **Why InnoDB?** It supports transactions, foreign keys and row locks.
3. **What is a primary key?** A unique, non-null identifier for a row.
4. **What is a foreign key?** A reference enforcing a valid parent relationship.
5. **What is a composite key?** A key containing several columns, such as the enrollment pair.
6. **Where is many-to-many used?** Students and subjects, through enrollments.
7. **Why separate class_sessions?** To identify a class event once and allow several periods per day.
8. **How are duplicates prevented?** Unique database keys and API validation.
9. **How is SQL injection prevented?** Prepared statements parameterize values; dynamic identifiers are fixed code choices.
10. **What does normalization prevent?** Redundancy and insertion, update and deletion anomalies.
11. **INNER versus LEFT JOIN?** Matching rows only versus all left rows, including unmatched rows.
12. **WHERE versus HAVING?** WHERE filters rows before grouping; HAVING filters aggregate groups.
13. **What if an attendance insert fails?** Roll back the entire session save.
14. **How is zero attendance handled?** NULL percentage, displayed as No records and excluded from below-75% lists.
15. **What happens on deletion?** Documented cascades delete dependent data after UI confirmation.

## Demonstration

Show the dashboard, add a student, verify the row in Workbench, select/create a subject, enroll the student, mark a complete session, inspect attendance in SQL, then open reports. Run examples from database/viva-queries.sql and explain the README ER diagram. Use fictional demo records.
