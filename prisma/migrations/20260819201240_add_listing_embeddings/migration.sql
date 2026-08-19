-- AlterTable
ALTER TABLE `Listing` ADD COLUMN `embedding` JSON NULL,
    ADD COLUMN `embeddingGeneratedAt` DATETIME(3) NULL,
    ADD COLUMN `embeddingModel` VARCHAR(191) NULL;

