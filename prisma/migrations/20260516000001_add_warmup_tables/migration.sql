-- CreateTable: warmup_inboxes
CREATE TABLE "WarmupInbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapUser" TEXT,
    "imapPass" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dailySentCount" INTEGER NOT NULL DEFAULT 0,
    "dailyLimit" INTEGER NOT NULL DEFAULT 30,
    "warmupPhase" TEXT NOT NULL DEFAULT 'ramp_up',  -- ramp_up, steady, cooldown
    "lastResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarmupInbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WarmupInbox_userId_idx" ON "WarmupInbox"("userId");
CREATE INDEX "WarmupInbox_status_idx" ON "WarmupInbox"("status");
CREATE UNIQUE INDEX "WarmupInbox_email_key" ON "WarmupInbox"("email");

-- CreateTable: warmup_threads
CREATE TABLE "WarmupThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "threadHistory" TEXT NOT NULL DEFAULT '[]',  -- JSON array of {role, content, messageId, timestamp}
    "lastMessageAt" DATETIME,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',  -- active, completed, stale
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarmupThread_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "WarmupInbox"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarmupThread_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "WarmupInbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WarmupThread_senderId_idx" ON "WarmupThread"("senderId");
CREATE INDEX "WarmupThread_receiverId_idx" ON "WarmupThread"("receiverId");
CREATE INDEX "WarmupThread_status_idx" ON "WarmupThread"("status");
CREATE UNIQUE INDEX "WarmupThread_sender_receiver_pair_key" ON "WarmupThread"("senderId", "receiverId");

-- CreateTable: warmup_logs
CREATE TABLE "WarmupLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,  -- sent, replied
    "messageId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, replied, failed
    "errorMessage" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarmupLog_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "WarmupThread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarmupLog_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "WarmupInbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WarmupLog_threadId_idx" ON "WarmupLog"("threadId");
CREATE INDEX "WarmupLog_inboxId_idx" ON "WarmupLog"("inboxId");
CREATE INDEX "WarmupLog_status_idx" ON "WarmupLog"("status");
CREATE INDEX "WarmupLog_createdAt_idx" ON "WarmupLog"("createdAt");