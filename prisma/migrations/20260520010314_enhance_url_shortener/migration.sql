-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShortenedUrl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "lastClickedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortenedUrl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ShortenedUrl" ("clicks", "createdAt", "id", "originalUrl", "shortCode", "updatedAt", "userId") SELECT "clicks", "createdAt", "id", "originalUrl", "shortCode", "updatedAt", "userId" FROM "ShortenedUrl";
DROP TABLE "ShortenedUrl";
ALTER TABLE "new_ShortenedUrl" RENAME TO "ShortenedUrl";
CREATE UNIQUE INDEX "ShortenedUrl_shortCode_key" ON "ShortenedUrl"("shortCode");
CREATE INDEX "ShortenedUrl_userId_idx" ON "ShortenedUrl"("userId");
CREATE INDEX "ShortenedUrl_shortCode_idx" ON "ShortenedUrl"("shortCode");
CREATE INDEX "ShortenedUrl_isActive_idx" ON "ShortenedUrl"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
