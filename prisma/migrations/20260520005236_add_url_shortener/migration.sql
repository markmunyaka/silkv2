-- CreateTable
CREATE TABLE "ShortenedUrl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortenedUrl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortenedUrl_shortCode_key" ON "ShortenedUrl"("shortCode");

-- CreateIndex
CREATE INDEX "ShortenedUrl_userId_idx" ON "ShortenedUrl"("userId");

-- CreateIndex
CREATE INDEX "ShortenedUrl_shortCode_idx" ON "ShortenedUrl"("shortCode");
