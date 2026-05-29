-- Add role and status columns to User table for admin management
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';