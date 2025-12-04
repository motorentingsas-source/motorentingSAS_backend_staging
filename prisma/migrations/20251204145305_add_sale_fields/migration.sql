-- CreateEnum
CREATE TYPE "public"."SaleState" AS ENUM ('PENDIENTE_POR_APROBAR', 'APROBADO', 'RECHAZADO', 'NA');

-- CreateEnum
CREATE TYPE "public"."Origin" AS ENUM ('CRM', 'TIKTOK', 'SALA', 'REDES_PROPIAS', 'REFERIDO', 'PLAN_MOTORENTING');

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'AUXILIAR';

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "origin" "public"."Origin" NOT NULL DEFAULT 'CRM',
ADD COLUMN     "saleDate" TIMESTAMP(3),
ADD COLUMN     "saleState" "public"."SaleState" NOT NULL DEFAULT 'NA';
