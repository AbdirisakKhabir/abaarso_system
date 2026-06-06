-- Simplify attendance taker assignments to lecturer + class only.

-- Keep one row per class/lecturer pair when migrating from course/shift rows.
DELETE t1 FROM `attendance_takers` t1
INNER JOIN `attendance_takers` t2
  ON t1.`classId` = t2.`classId`
 AND t1.`lecturerId` = t2.`lecturerId`
 AND t1.`id` > t2.`id`;

ALTER TABLE `attendance_takers` DROP FOREIGN KEY `attendance_takers_courseId_fkey`;
ALTER TABLE `attendance_takers` DROP INDEX `attendance_takers_classId_courseId_shift_key`;
ALTER TABLE `attendance_takers` DROP COLUMN `courseId`, DROP COLUMN `shift`;
CREATE UNIQUE INDEX `attendance_takers_classId_lecturerId_key` ON `attendance_takers`(`classId`, `lecturerId`);
