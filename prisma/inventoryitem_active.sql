ALTER TABLE `inventoryitem`
  ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `unit`;
