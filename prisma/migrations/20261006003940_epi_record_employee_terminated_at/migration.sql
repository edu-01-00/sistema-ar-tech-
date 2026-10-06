-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "terminatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "epi_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signedName" TEXT,
    "storageKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi_record_items" (
    "id" TEXT NOT NULL,
    "epiRecordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "caNumber" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "epi_records_employeeId_key" ON "epi_records"("employeeId");

-- AddForeignKey
ALTER TABLE "epi_records" ADD CONSTRAINT "epi_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_records" ADD CONSTRAINT "epi_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_record_items" ADD CONSTRAINT "epi_record_items_epiRecordId_fkey" FOREIGN KEY ("epiRecordId") REFERENCES "epi_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
