-- Backfill and add program across academic entities (default Bachelor)

-- Faculties: backfill null program, drop global uniques, add composite uniques
UPDATE `faculties` SET `program` = 'Bachelor' WHERE `program` IS NULL OR `program` = '';
ALTER TABLE `faculties` MODIFY `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';
ALTER TABLE `faculties` DROP INDEX `faculties_name_key`;
ALTER TABLE `faculties` DROP INDEX `faculties_code_key`;
CREATE UNIQUE INDEX `faculties_name_program_key` ON `faculties`(`name`, `program`);
CREATE UNIQUE INDEX `faculties_code_program_key` ON `faculties`(`code`, `program`);

-- Departments
ALTER TABLE `departments` ADD COLUMN `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';
ALTER TABLE `departments` DROP INDEX `departments_name_key`;
ALTER TABLE `departments` DROP INDEX `departments_code_key`;
CREATE UNIQUE INDEX `departments_name_program_key` ON `departments`(`name`, `program`);
CREATE UNIQUE INDEX `departments_code_program_key` ON `departments`(`code`, `program`);

-- Courses
ALTER TABLE `courses` ADD COLUMN `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';

-- Semesters
ALTER TABLE `semesters` ADD COLUMN `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';
ALTER TABLE `semesters` DROP INDEX `semesters_name_key`;
CREATE UNIQUE INDEX `semesters_name_program_key` ON `semesters`(`name`, `program`);

-- Classes
ALTER TABLE `classes` ADD COLUMN `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';
ALTER TABLE `classes` DROP INDEX `classes_name_semester_year_key`;
CREATE UNIQUE INDEX `classes_name_semester_year_program_key` ON `classes`(`name`, `semester`, `year`, `program`);

-- Students
UPDATE `students` SET `program` = 'Bachelor' WHERE `program` IS NULL OR `program` = '';
ALTER TABLE `students` MODIFY `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';

-- Lecturers
ALTER TABLE `lecturers` ADD COLUMN `program` VARCHAR(191) NOT NULL DEFAULT 'Bachelor';
