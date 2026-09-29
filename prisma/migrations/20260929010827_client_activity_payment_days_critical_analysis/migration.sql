-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "activityStartDate" TIMESTAMP(3),
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "mainActivity" TEXT,
ADD COLUMN     "stateRegistration" TEXT;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "criticalAnalysisReq1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criticalAnalysisReq2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criticalAnalysisReq3" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criticalAnalysisReq4" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exhibitTravelValue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "firstInstallmentDueDays" INTEGER,
ADD COLUMN     "paymentDueDays" INTEGER;
