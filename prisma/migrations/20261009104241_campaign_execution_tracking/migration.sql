-- CreateEnum
CREATE TYPE "ProductiveProcessStatus" AS ENUM ('PLANEJADO', 'AGENDADO', 'EM_CAMPO', 'RECEBIDO_CUSTODIA', 'EM_ANALISE', 'VALIDADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('ACEITA', 'ACEITA_COM_RESSALVAS', 'REJEITADA');

-- AlterTable
ALTER TABLE "productive_processes" ADD COLUMN     "status" "ProductiveProcessStatus" NOT NULL DEFAULT 'PLANEJADO';

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "calibrationCertificate" TEXT,
    "calibrationValidUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sampling_plans" (
    "id" TEXT NOT NULL,
    "productiveProcessId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "fieldResponsibleId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sampling_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sampling_plan_equipment" (
    "id" TEXT NOT NULL,
    "samplingPlanId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "calibrationValidUntilSnapshot" TIMESTAMP(3),

    CONSTRAINT "sampling_plan_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_entries" (
    "id" TEXT NOT NULL,
    "productiveProcessId" TEXT NOT NULL,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT NOT NULL,
    "weatherConditions" TEXT,
    "temperatureC" DECIMAL(5,2),
    "humidityPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_acceptances" (
    "id" TEXT NOT NULL,
    "productiveProcessId" TEXT NOT NULL,
    "status" "AcceptanceStatus" NOT NULL,
    "filtersIntegrityOk" BOOLEAN NOT NULL DEFAULT true,
    "sealsIntegrityOk" BOOLEAN NOT NULL DEFAULT true,
    "absorbentSolutionOk" BOOLEAN NOT NULL DEFAULT true,
    "deviationNotes" TEXT,
    "acceptedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_worksheets" (
    "id" TEXT NOT NULL,
    "productiveProcessId" TEXT NOT NULL,
    "analyzedById" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "result_worksheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_worksheet_gravimetry" (
    "resultWorksheetId" TEXT NOT NULL,
    "filterWeightBefore" DECIMAL(10,4),
    "filterWeightAfter" DECIMAL(10,4),
    "fieldBlankWeight" DECIMAL(10,4),
    "labReadingValue" DECIMAL(12,4),
    "sampledVolumeM3" DECIMAL(10,4),

    CONSTRAINT "result_worksheet_gravimetry_pkey" PRIMARY KEY ("resultWorksheetId")
);

-- CreateTable
CREATE TABLE "result_worksheet_acoustic" (
    "resultWorksheetId" TEXT NOT NULL,
    "leqDba" DECIMAL(6,2),
    "l10Dba" DECIMAL(6,2),
    "l90Dba" DECIMAL(6,2),
    "backgroundNoiseDba" DECIMAL(6,2),
    "measurementMinutes" INTEGER,

    CONSTRAINT "result_worksheet_acoustic_pkey" PRIMARY KEY ("resultWorksheetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sampling_plans_productiveProcessId_key" ON "sampling_plans"("productiveProcessId");

-- CreateIndex
CREATE INDEX "sampling_plan_equipment_samplingPlanId_idx" ON "sampling_plan_equipment"("samplingPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "custody_entries_productiveProcessId_key" ON "custody_entries"("productiveProcessId");

-- CreateIndex
CREATE UNIQUE INDEX "sample_acceptances_productiveProcessId_key" ON "sample_acceptances"("productiveProcessId");

-- CreateIndex
CREATE UNIQUE INDEX "result_worksheets_productiveProcessId_key" ON "result_worksheets"("productiveProcessId");

-- AddForeignKey
ALTER TABLE "sampling_plans" ADD CONSTRAINT "sampling_plans_productiveProcessId_fkey" FOREIGN KEY ("productiveProcessId") REFERENCES "productive_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sampling_plans" ADD CONSTRAINT "sampling_plans_fieldResponsibleId_fkey" FOREIGN KEY ("fieldResponsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sampling_plans" ADD CONSTRAINT "sampling_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sampling_plan_equipment" ADD CONSTRAINT "sampling_plan_equipment_samplingPlanId_fkey" FOREIGN KEY ("samplingPlanId") REFERENCES "sampling_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sampling_plan_equipment" ADD CONSTRAINT "sampling_plan_equipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_entries" ADD CONSTRAINT "custody_entries_productiveProcessId_fkey" FOREIGN KEY ("productiveProcessId") REFERENCES "productive_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_entries" ADD CONSTRAINT "custody_entries_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_acceptances" ADD CONSTRAINT "sample_acceptances_productiveProcessId_fkey" FOREIGN KEY ("productiveProcessId") REFERENCES "productive_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_acceptances" ADD CONSTRAINT "sample_acceptances_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_worksheets" ADD CONSTRAINT "result_worksheets_productiveProcessId_fkey" FOREIGN KEY ("productiveProcessId") REFERENCES "productive_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_worksheets" ADD CONSTRAINT "result_worksheets_analyzedById_fkey" FOREIGN KEY ("analyzedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_worksheets" ADD CONSTRAINT "result_worksheets_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_worksheet_gravimetry" ADD CONSTRAINT "result_worksheet_gravimetry_resultWorksheetId_fkey" FOREIGN KEY ("resultWorksheetId") REFERENCES "result_worksheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_worksheet_acoustic" ADD CONSTRAINT "result_worksheet_acoustic_resultWorksheetId_fkey" FOREIGN KEY ("resultWorksheetId") REFERENCES "result_worksheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
