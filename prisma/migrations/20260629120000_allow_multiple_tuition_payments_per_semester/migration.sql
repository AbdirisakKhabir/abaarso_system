-- Drop unique constraint so students can make up to 2 partial payments per semester
DROP INDEX `tuition_payments_studentId_semester_year_key` ON `tuition_payments`;

-- Non-unique index for lookups by student/term
CREATE INDEX `tuition_payments_studentId_semester_year_idx` ON `tuition_payments`(`studentId`, `semester`, `year`);
