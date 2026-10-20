CREATE DATABASE IF NOT EXISTS attendease CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE attendease;
CREATE TABLE IF NOT EXISTS students (
 id INT PRIMARY KEY AUTO_INCREMENT,
 roll_no VARCHAR(20) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 email VARCHAR(150) UNIQUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS subjects (
 id INT PRIMARY KEY AUTO_INCREMENT,
 code VARCHAR(20) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS enrollments (
 student_id INT NOT NULL,
 subject_id INT NOT NULL,
 PRIMARY KEY(student_id, subject_id),
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
 INDEX idx_enrollment_subject(subject_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS class_sessions (
 id INT PRIMARY KEY AUTO_INCREMENT,
 subject_id INT NOT NULL,
 session_date DATE NOT NULL,
 period_no INT NOT NULL,
 CONSTRAINT chk_period CHECK(period_no BETWEEN 1 AND 12),
 UNIQUE KEY uq_session(subject_id,session_date,period_no),
 FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
 INDEX idx_session_date(session_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance (
 id INT PRIMARY KEY AUTO_INCREMENT,
 session_id INT NOT NULL,
 student_id INT NOT NULL,
 status ENUM('Present','Absent') NOT NULL,
 UNIQUE KEY uq_attendance(session_id,student_id),
 FOREIGN KEY(session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
 INDEX idx_attendance_student(student_id)
) ENGINE=InnoDB;
