-- AlterTable
ALTER TABLE `students` ADD COLUMN `admissionAcademicYearId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_admissionAcademicYearId_fkey` FOREIGN KEY (`admissionAcademicYearId`) REFERENCES `academic_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
