/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `CustomerRegistration` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CustomerRegistration_customerId_key" ON "public"."CustomerRegistration"("customerId");
