-- CreateTable
CREATE TABLE `day_mark` (
    `id` VARCHAR(191) NOT NULL,
    `spaceId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `day` CHAR(10) NOT NULL,
    `title` VARCHAR(40) NOT NULL,
    `note` VARCHAR(200) NULL,
    `yearly` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `day_mark_spaceId_day_idx`(`spaceId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entry_read` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `readerId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `entry_read_entryId_idx`(`entryId`),
    UNIQUE INDEX `entry_read_entryId_readerId_key`(`entryId`, `readerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `day_mark` ADD CONSTRAINT `day_mark_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `day_mark` ADD CONSTRAINT `day_mark_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_read` ADD CONSTRAINT `entry_read_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_read` ADD CONSTRAINT `entry_read_readerId_fkey` FOREIGN KEY (`readerId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
