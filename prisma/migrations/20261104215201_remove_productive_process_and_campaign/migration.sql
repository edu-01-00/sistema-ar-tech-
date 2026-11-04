/*
  Warnings:

  - You are about to drop the `custody_entries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `equipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productive_processes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `result_worksheet_acoustic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `result_worksheet_gravimetry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `result_worksheets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sample_acceptances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sampling_plan_equipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sampling_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "custody_entries" DROP CONSTRAINT "custody_entries_productiveProcessId_fkey";

-- DropForeignKey
ALTER TABLE "custody_entries" DROP CONSTRAINT "custody_entries_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "productive_processes" DROP CONSTRAINT "productive_processes_collectionPointId_fkey";

-- DropForeignKey
ALTER TABLE "productive_processes" DROP CONSTRAINT "productive_processes_createdById_fkey";

-- DropForeignKey
ALTER TABLE "productive_processes" DROP CONSTRAINT "productive_processes_proposalId_fkey";

-- DropForeignKey
ALTER TABLE "result_worksheet_acoustic" DROP CONSTRAINT "result_worksheet_acoustic_resultWorksheetId_fkey";

-- DropForeignKey
ALTER TABLE "result_worksheet_gravimetry" DROP CONSTRAINT "result_worksheet_gravimetry_resultWorksheetId_fkey";

-- DropForeignKey
ALTER TABLE "result_worksheets" DROP CONSTRAINT "result_worksheets_analyzedById_fkey";

-- DropForeignKey
ALTER TABLE "result_worksheets" DROP CONSTRAINT "result_worksheets_productiveProcessId_fkey";

-- DropForeignKey
ALTER TABLE "result_worksheets" DROP CONSTRAINT "result_worksheets_validatedById_fkey";

-- DropForeignKey
ALTER TABLE "sample_acceptances" DROP CONSTRAINT "sample_acceptances_acceptedById_fkey";

-- DropForeignKey
ALTER TABLE "sample_acceptances" DROP CONSTRAINT "sample_acceptances_productiveProcessId_fkey";

-- DropForeignKey
ALTER TABLE "sampling_plan_equipment" DROP CONSTRAINT "sampling_plan_equipment_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "sampling_plan_equipment" DROP CONSTRAINT "sampling_plan_equipment_samplingPlanId_fkey";

-- DropForeignKey
ALTER TABLE "sampling_plans" DROP CONSTRAINT "sampling_plans_createdById_fkey";

-- DropForeignKey
ALTER TABLE "sampling_plans" DROP CONSTRAINT "sampling_plans_fieldResponsibleId_fkey";

-- DropForeignKey
ALTER TABLE "sampling_plans" DROP CONSTRAINT "sampling_plans_productiveProcessId_fkey";

-- DropForeignKey
ALTER TABLE "service_order_items" DROP CONSTRAINT "service_order_items_proposalTestId_fkey";

-- DropForeignKey
ALTER TABLE "service_order_items" DROP CONSTRAINT "service_order_items_serviceOrderId_fkey";

-- DropForeignKey
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_createdById_fkey";

-- DropForeignKey
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_productiveProcessId_fkey";

-- DropTable
DROP TABLE "custody_entries";

-- DropTable
DROP TABLE "equipment";

-- DropTable
DROP TABLE "productive_processes";

-- DropTable
DROP TABLE "result_worksheet_acoustic";

-- DropTable
DROP TABLE "result_worksheet_gravimetry";

-- DropTable
DROP TABLE "result_worksheets";

-- DropTable
DROP TABLE "sample_acceptances";

-- DropTable
DROP TABLE "sampling_plan_equipment";

-- DropTable
DROP TABLE "sampling_plans";

-- DropTable
DROP TABLE "service_order_items";

-- DropTable
DROP TABLE "service_orders";

-- DropEnum
DROP TYPE "AcceptanceStatus";

-- DropEnum
DROP TYPE "ProductiveProcessStatus";
