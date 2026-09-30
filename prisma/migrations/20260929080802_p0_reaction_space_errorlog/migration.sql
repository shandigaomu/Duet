-- AlterTable
ALTER TABLE `space` ADD COLUMN `anniversaryDay` CHAR(10) NULL,
    ADD COLUMN `name` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `entry_reaction` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(8) NOT NULL,
    `body` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entry_reaction_entryId_authorId_key`(`entryId`, `authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `error_log` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `route` VARCHAR(120) NOT NULL,
    `kind` VARCHAR(24) NOT NULL,
    `message` VARCHAR(300) NOT NULL,
    `stack` VARCHAR(2000) NULL,
    `ua` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `error_log_createdAt_idx`(`createdAt`),
    INDEX `error_log_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `entry_reaction` ADD CONSTRAINT `entry_reaction_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_reaction` ADD CONSTRAINT `entry_reaction_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `error_log` ADD CONSTRAINT `error_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
