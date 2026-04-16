-- Add per-course attendance: each session is for one course (scheduled for that class).

-- 1) Add nullable column first for backfill
ALTER TABLE `attendance_sessions` ADD COLUMN `courseId` INTEGER NULL;

-- 2) Backfill from class schedule (same semester/year as class)
UPDATE `attendance_sessions` AS `aps`
INNER JOIN `classes` AS `c` ON `c`.`id` = `aps`.`classId`
SET `aps`.`courseId` = (
  SELECT `cs`.`courseId`
  FROM `class_schedules` AS `cs`
  WHERE `cs`.`classId` = `aps`.`classId`
    AND `cs`.`semester` = `c`.`semester`
    AND `cs`.`year` = `c`.`year`
  ORDER BY `cs`.`id` ASC
  LIMIT 1
)
WHERE `aps`.`courseId` IS NULL;

-- 3) Fallback: any course in the class department
UPDATE `attendance_sessions` AS `aps`
INNER JOIN `classes` AS `cl` ON `cl`.`id` = `aps`.`classId`
SET `aps`.`courseId` = (
  SELECT `co`.`id` FROM `courses` AS `co` WHERE `co`.`departmentId` = `cl`.`departmentId` ORDER BY `co`.`id` ASC LIMIT 1
)
WHERE `aps`.`courseId` IS NULL;

-- 4) Remove orphaned records if no course could be resolved
DELETE `ar` FROM `attendance_records` AS `ar`
INNER JOIN `attendance_sessions` AS `aps` ON `aps`.`id` = `ar`.`sessionId`
WHERE `aps`.`courseId` IS NULL;

DELETE FROM `attendance_sessions` WHERE `courseId` IS NULL;

-- 5) Require course
ALTER TABLE `attendance_sessions` MODIFY `courseId` INTEGER NOT NULL;

-- 6) Drop old unique (name may be Prisma default or MySQL auto name)
DROP INDEX `AttendanceSession_classId_date_shift_key` ON `attendance_sessions`;

-- 7) Foreign key to courses
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8) New composite unique
CREATE UNIQUE INDEX `AttendanceSession_classId_courseId_date_shift_key` ON `attendance_sessions`(`classId`, `courseId`, `date`, `shift`);
