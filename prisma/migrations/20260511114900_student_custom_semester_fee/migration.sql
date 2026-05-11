-- Add optional per-student custom semester fee.
ALTER TABLE `students`
ADD COLUMN `customSemesterFee` DOUBLE NULL;
