CREATE TABLE `clientitemdimensioncode` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerDoc` VARCHAR(20) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `width` INT NOT NULL,
  `length` INT NOT NULL,
  `grammage` INT NOT NULL,
  `clientItemCode` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cidc_doc_sku_dims` (`customerDoc`, `sku`, `width`, `length`, `grammage`),
  KEY `idx_cidc_doc_sku` (`customerDoc`, `sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
