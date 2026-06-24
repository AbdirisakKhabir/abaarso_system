-- Expense categories lookup table

CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expense_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `expenses` ADD COLUMN `categoryId` INTEGER NULL;

ALTER TABLE `expenses` ADD CONSTRAINT `expenses_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed common categories
INSERT INTO `expense_categories` (`name`, `description`, `isActive`, `updatedAt`) VALUES
('Operations', 'Day-to-day operational costs', true, NOW(3)),
('Salaries', 'Staff and payroll related', true, NOW(3)),
('Utilities', 'Electricity, water, internet', true, NOW(3)),
('Supplies', 'Office and teaching supplies', true, NOW(3));
