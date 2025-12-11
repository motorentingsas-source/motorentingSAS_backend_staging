-- CreateTable
CREATE TABLE "public"."CustomerRegistration" (
    "id" SERIAL NOT NULL,
    "plate" TEXT NOT NULL,
    "soatValue" INTEGER NOT NULL,
    "registerValue" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRegistration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CustomerRegistration" ADD CONSTRAINT "CustomerRegistration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
