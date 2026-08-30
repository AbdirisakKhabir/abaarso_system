-- Track leave periods for students (status "Leave")
CREATE TABLE `student_leaves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `reason` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `student_leaves_studentId_idx` ON `student_leaves`(`studentId`);
CREATE INDEX `student_leaves_endDate_idx` ON `student_leaves`(`endDate`);

ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_leaves` ADD CONSTRAINT `student_leaves_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill an open leave row for anyone already marked Leave
INSERT INTO `student_leaves` (`studentId`, `startDate`, `endDate`, `reason`, `createdAt`, `updatedAt`)
SELECT `id`, `updatedAt`, NULL, NULL, NOW(3), NOW(3)
FROM `students`
WHERE `status` = 'Leave';
