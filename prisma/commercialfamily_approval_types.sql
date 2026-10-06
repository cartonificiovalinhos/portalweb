CREATE TABLE IF NOT EXISTS `commercialfamilyapprovaltype` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `commercialFamilyId` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` VARCHAR(255) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cfat_family_name` (`commercialFamilyId`, `name`),
  KEY `idx_cfat_family_sort` (`commercialFamilyId`, `sortOrder`),
  CONSTRAINT `fk_cfat_family` FOREIGN KEY (`commercialFamilyId`) REFERENCES `commercialfamily` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `commercialfamilyapprovaltypefield` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalTypeId` INT NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `fieldType` VARCHAR(20) NOT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cfaf_type_sort` (`approvalTypeId`, `sortOrder`),
  CONSTRAINT `fk_cfaf_type` FOREIGN KEY (`approvalTypeId`) REFERENCES `commercialfamilyapprovaltype` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `commercialfamilyapprovaltypeuser` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `approvalTypeId` INT NOT NULL,
  `approvalFieldId` INT NOT NULL,
  `userId` INT NOT NULL,
  `rangeFromValue` VARCHAR(100) NULL,
  `rangeToValue` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cfatu_type_field_user` (`approvalTypeId`, `approvalFieldId`, `userId`),
  KEY `idx_cfatu_user` (`userId`),
  KEY `idx_cfatu_type` (`approvalTypeId`),
  CONSTRAINT `fk_cfatu_type` FOREIGN KEY (`approvalTypeId`) REFERENCES `commercialfamilyapprovaltype` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cfatu_field` FOREIGN KEY (`approvalFieldId`) REFERENCES `commercialfamilyapprovaltypefield` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cfatu_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO `commercialfamilyapprovaltype` (
  `commercialFamilyId`,
  `name`,
  `description`,
  `sortOrder`,
  `isActive`,
  `createdAt`,
  `updatedAt`
)
SELECT
  cf.`id`,
  'AprovacaoDescontoComercial',
  'Aprovação migrada da parametrização anterior de desconto comercial.',
  1,
  1,
  NOW(),
  NOW()
FROM `commercialfamily` cf
WHERE EXISTS (
  SELECT 1
    FROM `commercialfamilyapprovaluser` old_cfg
   WHERE old_cfg.`commercialFamilyId` = cf.`id`
)
AND NOT EXISTS (
  SELECT 1
    FROM `commercialfamilyapprovaltype` t
   WHERE t.`commercialFamilyId` = cf.`id`
     AND t.`name` = 'AprovacaoDescontoComercial'
);

INSERT INTO `commercialfamilyapprovaltypefield` (
  `approvalTypeId`,
  `label`,
  `fieldType`,
  `required`,
  `sortOrder`,
  `createdAt`,
  `updatedAt`
)
SELECT
  t.`id`,
  'Descto Comercial R$',
  'DECIMAL',
  1,
  1,
  NOW(),
  NOW()
FROM `commercialfamilyapprovaltype` t
WHERE t.`name` = 'AprovacaoDescontoComercial'
AND NOT EXISTS (
  SELECT 1
    FROM `commercialfamilyapprovaltypefield` f
   WHERE f.`approvalTypeId` = t.`id`
     AND f.`label` = 'Descto Comercial R$'
);

INSERT INTO `commercialfamilyapprovaltypeuser` (
  `approvalTypeId`,
  `approvalFieldId`,
  `userId`,
  `rangeFromValue`,
  `rangeToValue`,
  `createdAt`,
  `updatedAt`
)
SELECT
  t.`id`,
  f.`id`,
  old_cfg.`userId`,
  CASE WHEN old_cfg.`discountFrom` IS NULL THEN NULL ELSE CAST(old_cfg.`discountFrom` AS CHAR(100)) END,
  CASE WHEN old_cfg.`discountTo` IS NULL THEN NULL ELSE CAST(old_cfg.`discountTo` AS CHAR(100)) END,
  NOW(),
  NOW()
FROM `commercialfamilyapprovaluser` old_cfg
INNER JOIN `commercialfamilyapprovaltype` t
        ON t.`commercialFamilyId` = old_cfg.`commercialFamilyId`
       AND t.`name` = 'AprovacaoDescontoComercial'
INNER JOIN `commercialfamilyapprovaltypefield` f
        ON f.`approvalTypeId` = t.`id`
       AND f.`label` = 'Descto Comercial R$'
LEFT JOIN `commercialfamilyapprovaltypeuser` new_cfg
       ON new_cfg.`approvalTypeId` = t.`id`
      AND new_cfg.`approvalFieldId` = f.`id`
      AND new_cfg.`userId` = old_cfg.`userId`
WHERE new_cfg.`id` IS NULL;
