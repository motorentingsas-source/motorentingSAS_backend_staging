/*
  Warnings:

  - You are about to drop the column `distributor` on the `CustomerPurchase` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "distributor" "public"."Distributor";

-- AlterTable
ALTER TABLE "public"."CustomerPurchase" DROP COLUMN "distributor";
