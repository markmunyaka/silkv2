/*
  Warnings:

  - You are about to drop the `domain_audit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `domain_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `domain_registrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `domains` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "audit_action_idx";

-- DropIndex
DROP INDEX "audit_domain_id_idx";

-- DropIndex
DROP INDEX "jobs_next_retry_at_idx";

-- DropIndex
DROP INDEX "jobs_status_idx";

-- DropIndex
DROP INDEX "jobs_registration_id_idx";

-- DropIndex
DROP INDEX "registrations_status_idx";

-- DropIndex
DROP INDEX "registrations_domain_id_idx";

-- DropIndex
DROP INDEX "registrations_stripe_payment_intent_idx";

-- DropIndex
DROP INDEX "domains_expiration_date_idx";

-- DropIndex
DROP INDEX "domains_user_id_idx";

-- DropIndex
DROP INDEX "domains_workspace_id_idx";

-- DropIndex
DROP INDEX "domains_domain_workspace_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "bannedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "frozenAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "violationReason" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "domain_audit_log";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "domain_jobs";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "domain_registrations";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "domains";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "VideoGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "errorMessage" TEXT,
    "savedFilePath" TEXT,
    "watermarked" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "urlExpiresAt" DATETIME,
    "fileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoGeneration_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmtpProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "maxEmailsPerDay" INTEGER NOT NULL DEFAULT 300,
    "maxEmailsPerHour" INTEGER NOT NULL DEFAULT 50,
    "delayBetweenEmailsMs" INTEGER NOT NULL DEFAULT 200,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisibleToUsers" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" DATETIME,
    "testStatus" TEXT,
    "testError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fileSize" INTEGER,
    "textLength" INTEGER,
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "adminNotes" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "downloadedByAdminAt" DATETIME,
    "deletedByAdminAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_File" ("audioUrl", "createdAt", "fileName", "id", "originalText", "summary", "updatedAt", "userId", "videoUrl") SELECT "audioUrl", "createdAt", "fileName", "id", "originalText", "summary", "updatedAt", "userId", "videoUrl" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VideoGeneration_taskId_key" ON "VideoGeneration"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGeneration_fileId_key" ON "VideoGeneration"("fileId");

-- CreateIndex
CREATE INDEX "VideoGeneration_userId_idx" ON "VideoGeneration"("userId");

-- CreateIndex
CREATE INDEX "VideoGeneration_taskId_idx" ON "VideoGeneration"("taskId");

-- CreateIndex
CREATE INDEX "VideoGeneration_status_idx" ON "VideoGeneration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SmtpProvider_name_key" ON "SmtpProvider"("name");

-- RedefineIndex
DROP INDEX "WarmupThread_sender_receiver_pair_key";
CREATE UNIQUE INDEX "WarmupThread_senderId_receiverId_key" ON "WarmupThread"("senderId", "receiverId");
