import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSchema,
  validateRoster,
  studentSchema,
  sessionSchema,
} from "../lib/validation";
test("complete roster accepted", () =>
  assert.doesNotThrow(() => validateRoster([1, 2], [2, 1])));
test("duplicate rejected", () =>
  assert.throws(() => validateRoster([1, 2], [1, 1]), /exactly once/));
test("non enrolled student rejected", () =>
  assert.throws(() => validateRoster([1], [2]), /not enrolled/));
test("partial roster rejected", () =>
  assert.throws(() => validateRoster([1, 2], [1]), /every/));
test("empty enrollment rejected", () =>
  assert.throws(() => validateRoster([], []), /every/));
test("invalid date and period rejected", () =>
  assert.equal(
    sessionSchema.safeParse({
      subject_id: 1,
      session_date: "2026-02-30",
      period_no: 0,
    }).success,
    false,
  ));
test("invalid status rejected", () =>
  assert.equal(
    attendanceSchema.safeParse({
      subject_id: 1,
      session_date: "2026-10-20",
      period_no: 1,
      records: [{ student_id: 1, status: "Late" }],
    }).success,
    false,
  ));
test("blank optional email becomes SQL null", () =>
  assert.equal(
    studentSchema.parse({ roll_no: "CS01", name: "Ananya Rao", email: "" })
      .email,
    null,
  ));
