-- CreateEnum
CREATE TYPE "ProfessionalRegistrationType" AS ENUM ('CRQ', 'CREA');

-- CreateEnum
CREATE TYPE "ChimneyInstallationYear" AS ENUM ('ANTERIOR_2007', 'POSTERIOR_2007');

-- CreateEnum
CREATE TYPE "ChimneyAccessType" AS ENUM ('PLATAFORMA_FIXA', 'PLATAFORMA_ELEVATORIA', 'SOLO', 'CAMINHAO_MUNCK', 'TELHADO');

-- CreateEnum
CREATE TYPE "ChimneyCoverage" AS ENUM ('COBERTO', 'DESCOBERTO');

-- CreateEnum
CREATE TYPE "ChimneyGeometry" AS ENUM ('RETANGULAR', 'CIRCULAR', 'QUADRADA');

-- CreateEnum
CREATE TYPE "AtmosphericEmissionType" AS ENUM ('COMBUSTAO', 'PROCESSO', 'NAO_APLICADO');

-- CreateEnum
CREATE TYPE "AtmosphericCombustionType" AS ENUM ('EXTERNA', 'NAO_EXTERNA', 'NAO_APLICADO');

-- CreateEnum
CREATE TYPE "OperationalCycle" AS ENUM ('CONTINUO', 'NAO_CONTINUO');

-- CreateEnum
CREATE TYPE "FuelConsumptionUnit" AS ENUM ('L_H', 'M3_H', 'KG_H');

-- CreateEnum
CREATE TYPE "PaymentTermOption" AS ENUM ('DIAS_15', 'DIAS_30', 'DIAS_30_60_90');

-- CreateEnum
CREATE TYPE "ProposalTextCategory" AS ENUM ('FORMA_PAGAMENTO_30', 'FORMA_PAGAMENTO_15_30', 'DECLARACAO_CONFORMIDADE', 'VALIDADE_PROPOSTA', 'PRAZO_ENTREGA_RELATORIO', 'OBSERVACAO_IMPORTANTE', 'PROTECAO_PROPRIEDADE_CLIENTE', 'CONFIRMACAO_PROPOSTA', 'OUTRAS_INFORMACOES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'BOLETO';
ALTER TYPE "PaymentMethod" ADD VALUE 'DEPOSITO_PIX';

-- AlterTable
ALTER TABLE "collection_point_air_quality" ADD COLUMN     "imageFileName" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imageStorageKey" TEXT;

-- AlterTable
ALTER TABLE "collection_point_atmospheric_emission" ADD COLUMN     "accessType" "ChimneyAccessType",
ADD COLUMN     "chimneyGeometry" "ChimneyGeometry",
ADD COLUMN     "combustionType" "AtmosphericCombustionType",
ADD COLUMN     "coverage" "ChimneyCoverage",
ADD COLUMN     "downstreamDistanceM" TEXT,
ADD COLUMN     "emissionType" "AtmosphericEmissionType",
ADD COLUMN     "flangeSleeveCm" TEXT,
ADD COLUMN     "fuel" TEXT,
ADD COLUMN     "fuelConsumption" TEXT,
ADD COLUMN     "fuelConsumptionUnit" "FuelConsumptionUnit",
ADD COLUMN     "geographicCoordinates" TEXT,
ADD COLUMN     "installationYear" "ChimneyInstallationYear",
ADD COLUMN     "internalEquivalentDuctDiameterM" TEXT,
ADD COLUMN     "internalLengthM" TEXT,
ADD COLUMN     "internalWidthM" TEXT,
ADD COLUMN     "nominalPowerMw" TEXT,
ADD COLUMN     "operatingConditions" TEXT,
ADD COLUMN     "operatingDaysAndHours" TEXT,
ADD COLUMN     "operationalCycle" "OperationalCycle",
ADD COLUMN     "pollutionControlType" TEXT,
ADD COLUMN     "processDescription" TEXT,
ADD COLUMN     "productsAndQuantities" TEXT,
ADD COLUMN     "rawMaterialsAndQuantities" TEXT,
ADD COLUMN     "samplingDeviations" TEXT,
ADD COLUMN     "totalChimneyLengthM" TEXT,
ADD COLUMN     "totalChimneyLengthToGroundM" TEXT,
ADD COLUMN     "upstreamDistanceM" TEXT,
ADD COLUMN     "wallThicknessCm" TEXT;

-- AlterTable
ALTER TABLE "collection_point_noise" ADD COLUMN     "gpsLatitude" TEXT,
ADD COLUMN     "gpsLongitude" TEXT,
ADD COLUMN     "imageFileName" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imageStorageKey" TEXT,
ADD COLUMN     "knownSamplingDeviation" TEXT,
ADD COLUMN     "mapsLink" TEXT,
ADD COLUMN     "surroundingsDescription" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankAccountType" TEXT,
ADD COLUMN     "bankAgency" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankPixKey" TEXT,
ADD COLUMN     "logoFileName" TEXT,
ADD COLUMN     "logoMimeType" TEXT,
ADD COLUMN     "logoStorageKey" TEXT,
ADD COLUMN     "professionalRegistrationNumber" TEXT,
ADD COLUMN     "professionalRegistrationType" "ProfessionalRegistrationType";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "registrationNumber" TEXT;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "criticalAnalysisAt" TIMESTAMP(3),
ADD COLUMN     "criticalAnalysisById" TEXT,
ADD COLUMN     "criticalAnalysisConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exhibitUnitValue" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "observationEmissoesAtmosfericas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observationQualidadeAr" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observationRuido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentTerm" "PaymentTermOption",
ADD COLUMN     "useAdditionalCosts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "measurement_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_text_templates" (
    "id" TEXT NOT NULL,
    "category" "ProposalTextCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "matrix" "TestMatrix",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_text_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_text_snapshots" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "category" "ProposalTextCategory" NOT NULL,
    "matrix" "TestMatrix",
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "proposal_text_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_name_key" ON "measurement_units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_text_templates_category_matrix_key" ON "proposal_text_templates"("category", "matrix");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_text_snapshots_proposalId_category_matrix_key" ON "proposal_text_snapshots"("proposalId", "category", "matrix");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_criticalAnalysisById_fkey" FOREIGN KEY ("criticalAnalysisById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_text_templates" ADD CONSTRAINT "proposal_text_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_text_snapshots" ADD CONSTRAINT "proposal_text_snapshots_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
