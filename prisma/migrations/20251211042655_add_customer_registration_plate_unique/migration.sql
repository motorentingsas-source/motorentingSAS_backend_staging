/*
  Warnings:

  - A unique constraint covering the columns `[plate]` on the table `CustomerRegistration` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CustomerRegistration_plate_key" ON "public"."CustomerRegistration"("plate");
