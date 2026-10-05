-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
