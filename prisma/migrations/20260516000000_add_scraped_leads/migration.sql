-- CreateTable
CREATE TABLE "ScrapedLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT NOT NULL,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScrapedLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScrapedLead_userId_idx" ON "ScrapedLead"("userId");

-- CreateIndex
CREATE INDEX "ScrapedLead_status_idx" ON "ScrapedLead"("status");

-- CreateIndex
CREATE INDEX "ScrapedLead_userId_status_idx" ON "ScrapedLead"("userId", "status");