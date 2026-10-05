-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "sector" TEXT;

-- AlterTable
ALTER TABLE "epi_orders" ADD COLUMN     "activities" TEXT,
ADD COLUMN     "positionSnapshot" TEXT,
ADD COLUMN     "sectorSnapshot" TEXT;
