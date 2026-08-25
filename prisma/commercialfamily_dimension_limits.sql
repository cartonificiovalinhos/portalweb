ALTER TABLE `commercialfamily`
  ADD COLUMN `widthMin` INT NULL AFTER `priceBy`,
  ADD COLUMN `widthMax` INT NULL AFTER `widthMin`,
  ADD COLUMN `lengthMin` INT NULL AFTER `widthMax`,
  ADD COLUMN `lengthMax` INT NULL AFTER `lengthMin`;
