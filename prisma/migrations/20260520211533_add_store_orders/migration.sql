-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSpecs" TEXT,
    "price" REAL NOT NULL,
    "duration" TEXT,
    "config" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "credentials" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoreOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StoreOrder_userId_idx" ON "StoreOrder"("userId");

-- CreateIndex
CREATE INDEX "StoreOrder_productType_idx" ON "StoreOrder"("productType");

-- CreateIndex
CREATE INDEX "StoreOrder_status_idx" ON "StoreOrder"("status");
