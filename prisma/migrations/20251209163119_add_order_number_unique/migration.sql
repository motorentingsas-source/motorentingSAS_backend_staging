/*
  Warnings:

  - A unique constraint covering the columns `[orderNumber]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_orderNumber_key" ON "public"."Customer"("orderNumber");
