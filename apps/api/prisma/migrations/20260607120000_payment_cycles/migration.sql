-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "lessonsInCycle" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "nextPaymentDue" TIMESTAMP(3);
