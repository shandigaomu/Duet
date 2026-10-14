-- AlterTable
ALTER TABLE `check_in` ADD COLUMN `city` VARCHAR(40) NULL,
    ADD COLUMN `company` VARCHAR(16) NULL;

-- AlterTable
ALTER TABLE `note` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `readAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `goal` (
    `id` VARCHAR(191) NOT NULL,
    `spaceId` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(40) NOT NULL,
    `note` VARCHAR(200) NULL,
    `targetDay` CHAR(10) NULL,
    `status` VARCHAR(8) NOT NULL DEFAULT 'open',
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `goal_spaceId_status_idx`(`spaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_step` (
    `id` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(60) NOT NULL,
    `doneById` VARCHAR(191) NULL,
    `doneAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `goal_step_goalId_sortOrder_idx`(`goalId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `note_expiresAt_idx` ON `note`(`expiresAt`);

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_step` ADD CONSTRAINT `goal_step_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_step` ADD CONSTRAINT `goal_step_doneById_fkey` FOREIGN KEY (`doneById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
