CREATE TABLE IF NOT EXISTS `trusteddevice` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `userAgent` VARCHAR(255) NULL,
  `expiresAt` DATETIME(3) NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `trusteddevice_tokenHash_key` (`tokenHash`),
  KEY `trusteddevice_userId_idx` (`userId`),
  KEY `trusteddevice_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `trusteddevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
