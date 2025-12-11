/*
  Warnings:

  - You are about to drop the column `orderNumber` on the `CustomerInvoice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `CustomerInvoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `CustomerInvoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."CustomerInvoice" DROP COLUMN "orderNumber",
ADD COLUMN     "invoiceNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_invoiceNumber_key" ON "public"."CustomerInvoice"("invoiceNumber");
