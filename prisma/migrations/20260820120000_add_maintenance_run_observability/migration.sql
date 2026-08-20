-- CreateTable
CREATE TABLE `FreshnessCheckRun` (
    `id` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED') NOT NULL,
    `listingsChecked` INTEGER NOT NULL DEFAULT 0,
    `listingsExpired` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `freshness_check_runs_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmbeddingBackfillRun` (
    `id` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED') NOT NULL,
    `listingsProcessed` INTEGER NOT NULL DEFAULT 0,
    `embeddingsGenerated` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `embedding_backfill_runs_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

