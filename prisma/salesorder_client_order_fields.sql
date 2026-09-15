ALTER TABLE `salesorder`
  ADD COLUMN `clientOrderNumber` VARCHAR(255) NULL AFTER `customerDoc`;

ALTER TABLE `salesorderitem`
  ADD COLUMN `clientItemCode` VARCHAR(255) NULL AFTER `clientOrderNumber`;
