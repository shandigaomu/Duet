-- AlterTable
ALTER TABLE `entry` ADD COLUMN `collabStatus` VARCHAR(16) NOT NULL DEFAULT 'none',
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `note` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `space_member` ADD COLUMN `timeZone` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `check_in_hug` (
    `id` VARCHAR(191) NOT NULL,
    `checkInId` VARCHAR(191) NOT NULL,
    `giverId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `check_in_hug_checkInId_giverId_key`(`checkInId`, `giverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letter` (
    `id` VARCHAR(191) NOT NULL,
    `spaceId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NULL,
    `body` VARCHAR(2000) NOT NULL,
    `imageUrl` VARCHAR(512) NULL,
    `unlockDay` CHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `letter_spaceId_unlockDay_idx`(`spaceId`, `unlockDay`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entry_section` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `images` JSON NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entry_section_entryId_authorId_key`(`entryId`, `authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(512) NOT NULL,
    `endpointHash` CHAR(64) NOT NULL,
    `p256dh` VARCHAR(160) NOT NULL,
    `auth` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `push_subscriptions_userId_endpointHash_key`(`userId`, `endpointHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notify_pref` (
    `userId` VARCHAR(191) NOT NULL,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT true,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
    `emailWeekly` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_lock` (
    `userId` VARCHAR(191) NOT NULL,
    `pinHash` VARCHAR(100) NOT NULL,
    `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `entry_spaceId_deletedAt_idx` ON `entry`(`spaceId`, `deletedAt`);

-- CreateIndex
CREATE INDEX `entry_spaceId_collabStatus_idx` ON `entry`(`spaceId`, `collabStatus`);

-- CreateIndex
CREATE INDEX `note_spaceId_deletedAt_idx` ON `note`(`spaceId`, `deletedAt`);

-- AddForeignKey
ALTER TABLE `check_in_hug` ADD CONSTRAINT `check_in_hug_checkInId_fkey` FOREIGN KEY (`checkInId`) REFERENCES `check_in`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `check_in_hug` ADD CONSTRAINT `check_in_hug_giverId_fkey` FOREIGN KEY (`giverId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letter` ADD CONSTRAINT `letter_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letter` ADD CONSTRAINT `letter_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_section` ADD CONSTRAINT `entry_section_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_section` ADD CONSTRAINT `entry_section_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notify_pref` ADD CONSTRAINT `notify_pref_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_lock` ADD CONSTRAINT `app_lock_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

