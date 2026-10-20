-- Read-only snapshot of live SHOW CREATE TABLE output.
-- For offline Workbench import; this file has not been executed.
CREATE DATABASE IF NOT EXISTS attendease;
USE attendease;

CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `subjects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `enrollments` (
  `student_id` int NOT NULL,
  `subject_id` int NOT NULL,
  PRIMARY KEY (`student_id`,`subject_id`),
  KEY `idx_enrollment_subject` (`subject_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `class_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subject_id` int NOT NULL,
  `session_date` date NOT NULL,
  `period_no` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session` (`subject_id`,`session_date`,`period_no`),
  KEY `idx_session_date` (`session_date`),
  CONSTRAINT `class_sessions_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_period` CHECK ((`period_no` between 1 and 12))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `student_id` int NOT NULL,
  `status` enum('Present','Absent') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance` (`session_id`,`student_id`),
  KEY `idx_attendance_student` (`student_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `class_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
