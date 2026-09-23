-- AlterTable
ALTER TABLE `entry` ADD COLUMN `visibility` VARCHAR(16) NOT NULL DEFAULT 'shared';

-- CreateTable
CREATE TABLE `list_item` (
    `id` VARCHAR(191) NOT NULL,
    `spaceId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(8) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `status` VARCHAR(8) NOT NULL DEFAULT 'open',
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `list_item_spaceId_status_category_idx`(`spaceId`, `status`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `note` (
    `id` VARCHAR(191) NOT NULL,
    `spaceId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `note_spaceId_createdAt_idx`(`spaceId`, `createdAt`),
    INDEX `note_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `list_item` ADD CONSTRAINT `list_item_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `list_item` ADD CONSTRAINT `list_item_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `note` ADD CONSTRAINT `note_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `note` ADD CONSTRAINT `note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `note` ADD CONSTRAINT `note_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
