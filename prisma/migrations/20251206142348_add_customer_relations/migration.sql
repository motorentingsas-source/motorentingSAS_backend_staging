-- CreateEnum
CREATE TYPE "public"."FinancialEntity" AS ENUM ('PROGRESER', 'SUFI', 'CREDIORBE', 'SISTECREDITO', 'ADDI', 'VANTI', 'BANCO_DE_BOGOTA', 'VEHIGROUP', 'MOTORENTING_PLUS', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'EFECTIVO', 'OTROS');

-- CreateEnum
CREATE TYPE "public"."Distributor" AS ENUM ('DIGIMOTOS_SAS', 'COLCAMER_SAS', 'BMR_GROUP_SAS', 'DIVERXA_SAS', 'SUPERMOTOS_SAS', 'MOTORENTING_SAS', 'OTROS');

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "orderNumber" TEXT;

-- CreateTable
CREATE TABLE "public"."CustomerHolder" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "financialEntity" "public"."FinancialEntity" NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerHolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerPurchase" (
    "id" SERIAL NOT NULL,
    "brand" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "mainColor" TEXT NOT NULL,
    "optionalColor" TEXT,
    "commercialValue" INTEGER NOT NULL,
    "processValue" INTEGER NOT NULL,
    "totalValue" INTEGER NOT NULL,
    "distributor" "public"."Distributor" NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerPayment" (
    "id" SERIAL NOT NULL,
    "financialEntity" "public"."FinancialEntity" NOT NULL,
    "totalPayment" INTEGER NOT NULL,
    "aval" INTEGER NOT NULL,
    "approvalDate" TIMESTAMP(3),
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerReceipt" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPurchase_customerId_key" ON "public"."CustomerPurchase"("customerId");

-- AddForeignKey
ALTER TABLE "public"."CustomerHolder" ADD CONSTRAINT "CustomerHolder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPurchase" ADD CONSTRAINT "CustomerPurchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPayment" ADD CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
