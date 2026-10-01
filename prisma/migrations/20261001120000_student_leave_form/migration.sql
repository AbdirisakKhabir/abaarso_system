-- Student Leave Form fields (type, planned end date, contacts, documents, approval)
ALTER TABLE `student_leaves`
    ADD COLUMN `expectedEndDate` DATETIME(3) NULL,
    ADD COLUMN `leaveType` VARCHAR(191) NULL,
    ADD COLUMN `leaveTypeOther` VARCHAR(191) NULL,
    ADD COLUMN `contactEmail` VARCHAR(191) NULL,
    ADD COLUMN `contactPhone` VARCHAR(191) NULL,
    ADD COLUMN `parentPhone` VARCHAR(191) NULL,
    ADD COLUMN `documentUrl` TEXT NULL,
    ADD COLUMN `documentPublicId` VARCHAR(191) NULL,
    ADD COLUMN `declarationSigned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'Approved',
    ADD COLUMN `approvedByName` VARCHAR(191) NULL,
    ADD COLUMN `approvalDate` DATETIME(3) NULL;
