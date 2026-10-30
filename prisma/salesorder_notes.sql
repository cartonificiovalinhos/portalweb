ALTER TABLE `salesorder`
  ADD COLUMN IF NOT EXISTS `notes` TEXT NULL AFTER `deliveryDate`;
