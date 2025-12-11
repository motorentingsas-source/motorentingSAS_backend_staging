/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `CustomerInvoice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_customerId_key" ON "public"."CustomerInvoice"("customerId");
