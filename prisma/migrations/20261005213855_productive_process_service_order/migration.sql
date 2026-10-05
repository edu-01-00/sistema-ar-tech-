-- CreateTable
CREATE TABLE "productive_processes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "proposalId" TEXT NOT NULL,
    "collectionPointId" TEXT NOT NULL,
    "lastServiceOrderNumber" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productive_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sequenceInProcess" INTEGER NOT NULL,
    "productiveProcessId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_items" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "proposalTestId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "service_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productive_processes_code_key" ON "productive_processes"("code");

-- CreateIndex
CREATE INDEX "productive_processes_proposalId_idx" ON "productive_processes"("proposalId");

-- CreateIndex
CREATE INDEX "productive_processes_collectionPointId_idx" ON "productive_processes"("collectionPointId");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_code_key" ON "service_orders"("code");

-- CreateIndex
CREATE INDEX "service_orders_productiveProcessId_idx" ON "service_orders"("productiveProcessId");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_productiveProcessId_sequenceInProcess_key" ON "service_orders"("productiveProcessId", "sequenceInProcess");

-- CreateIndex
CREATE INDEX "service_order_items_serviceOrderId_idx" ON "service_order_items"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "productive_processes" ADD CONSTRAINT "productive_processes_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productive_processes" ADD CONSTRAINT "productive_processes_collectionPointId_fkey" FOREIGN KEY ("collectionPointId") REFERENCES "collection_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productive_processes" ADD CONSTRAINT "productive_processes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_productiveProcessId_fkey" FOREIGN KEY ("productiveProcessId") REFERENCES "productive_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_items" ADD CONSTRAINT "service_order_items_proposalTestId_fkey" FOREIGN KEY ("proposalTestId") REFERENCES "proposal_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
