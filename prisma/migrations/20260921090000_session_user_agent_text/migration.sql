-- 手机浏览器 User-Agent 常超过 VARCHAR(191)，登录写 session 会 P2000
ALTER TABLE `session` MODIFY `userAgent` TEXT NULL;
ALTER TABLE `session` MODIFY `ipAddress` VARCHAR(64) NULL;
-- COS 头像 URL 可能较长
ALTER TABLE `user` MODIFY `image` VARCHAR(512) NULL;
