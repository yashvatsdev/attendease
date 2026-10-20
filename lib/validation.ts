import { z } from "zod";
export const idSchema = z.coerce.number().int().positive();
export const studentSchema = z.object({
  roll_no: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
  email: z
    .union([z.email().max(150), z.literal("")])
    .optional()
    .transform((v) => v || null),
});
export const subjectSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(100),
});
export const enrollmentSchema = z.object({
  student_id: idSchema,
  subject_id: idSchema,
});
export const sessionSchema = z.object({
  subject_id: idSchema,
  session_date: z.iso.date(),
  period_no: z.coerce.number().int().min(1).max(12),
});
export const attendanceSchema = sessionSchema.extend({
  session_id: idSchema.optional(),
  records: z
    .array(
      z.object({ student_id: idSchema, status: z.enum(["Present", "Absent"]) }),
    )
    .min(1)
    .max(10000),
});
export function validateRoster(enrolled: number[], submitted: number[]) {
  if (new Set(submitted).size !== submitted.length)
    throw new Error("Each student must appear exactly once.");
  if (submitted.some((id) => !enrolled.includes(id)))
    throw new Error("Attendance contains a student who is not enrolled.");
  if (enrolled.length === 0 || enrolled.length !== submitted.length)
    throw new Error("Mark every enrolled student before saving attendance.");
}
