CREATE TABLE IF NOT EXISTS `approvaldocument` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `internalCode` VARCHAR(64) NOT NULL,
  `erpId` VARCHAR(20) NULL,
  `description` VARCHAR(255) NOT NULL,
  `moduleCode` VARCHAR(40) NULL,
  `entityName` VARCHAR(60) NULL,
  `actionName` VARCHAR(20) NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `approvaldocument_internalCode_key` (`internalCode`),
  UNIQUE KEY `approvaldocument_erpId_key` (`erpId`),
  KEY `idx_ad_sort` (`sortOrder`),
  KEY `idx_ad_target` (`moduleCode`, `entityName`, `actionName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvaldocumenttype` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalDocumentId` INT NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_adt_document_name` (`approvalDocumentId`, `name`),
  KEY `idx_adt_document_sort` (`approvalDocumentId`, `sortOrder`),
  CONSTRAINT `fk_adt_document` FOREIGN KEY (`approvalDocumentId`) REFERENCES `approvaldocument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvaldocumenttypefield` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalTypeId` INT NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `fieldType` VARCHAR(20) NOT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `sourceType` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  `entityFieldKey` VARCHAR(80) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_adtf_type_sort` (`approvalTypeId`, `sortOrder`),
  CONSTRAINT `fk_adtf_type` FOREIGN KEY (`approvalTypeId`) REFERENCES `approvaldocumenttype` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvaldocumenttypeuser` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalTypeId` INT NOT NULL,
  `approvalFieldId` INT NOT NULL,
  `userId` INT NOT NULL,
  `rangeFromValue` VARCHAR(255) NULL,
  `rangeToValue` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_adtu_type_field_user` (`approvalTypeId`, `approvalFieldId`, `userId`),
  KEY `idx_adtu_user` (`userId`),
  KEY `idx_adtu_type` (`approvalTypeId`),
  CONSTRAINT `fk_adtu_type` FOREIGN KEY (`approvalTypeId`) REFERENCES `approvaldocumenttype` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_adtu_field` FOREIGN KEY (`approvalFieldId`) REFERENCES `approvaldocumenttypefield` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_adtu_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvalpending` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalDocumentId` INT NOT NULL,
  `approvalTypeId` INT NOT NULL,
  `approvalFieldId` INT NOT NULL,
  `userId` INT NOT NULL,
  `entityName` VARCHAR(60) NOT NULL,
  `entityKey` VARCHAR(120) NOT NULL,
  `rootEntityName` VARCHAR(60) NOT NULL,
  `rootEntityKey` VARCHAR(120) NOT NULL,
  `triggerAction` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `createdDate` VARCHAR(10) NOT NULL,
  `createdTime` VARCHAR(8) NOT NULL,
  `approvedDate` VARCHAR(10) NULL,
  `approvedTime` VARCHAR(8) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ap_entity_user` (`approvalDocumentId`, `approvalTypeId`, `approvalFieldId`, `userId`, `entityName`, `entityKey`),
  KEY `idx_ap_root_status` (`rootEntityName`, `rootEntityKey`, `status`),
  KEY `idx_ap_user_status` (`userId`, `status`),
  CONSTRAINT `fk_ap_document` FOREIGN KEY (`approvalDocumentId`) REFERENCES `approvaldocument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ap_type` FOREIGN KEY (`approvalTypeId`) REFERENCES `approvaldocumenttype` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ap_field` FOREIGN KEY (`approvalFieldId`) REFERENCES `approvaldocumenttypefield` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ap_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
