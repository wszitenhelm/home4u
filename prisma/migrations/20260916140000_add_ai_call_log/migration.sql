-- CreateTable
CREATE TABLE `AiCallLog` (
    `id` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `fallbackTriggered` BOOLEAN NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `detail` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_call_logs_createdAt_idx`(`createdAt`),
    INDEX `ai_call_logs_event_createdAt_idx`(`event`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

