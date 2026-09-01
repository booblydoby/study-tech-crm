-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "dueAmount" INTEGER NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "lessonsInCycle" INTEGER,
    "nextPaymentDue" TIMESTAMP(3),
    "status" "ChargeStatus" NOT NULL DEFAULT 'UNPAID',
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_studentId_idx" ON "Charge"("studentId");
CREATE INDEX "Charge_enrollmentId_idx" ON "Charge"("enrollmentId");
CREATE INDEX "Charge_status_idx" ON "Charge"("status");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: связь взноса с начислением
ALTER TABLE "Payment" ADD COLUMN "chargeId" TEXT;

-- Backfill: каждая существующая оплата превращается в начисление (полностью оплаченное)
INSERT INTO "Charge" ("id", "studentId", "enrollmentId", "dueAmount", "periodFrom", "periodTo", "lessonsInCycle", "nextPaymentDue", "status", "comment", "createdById", "createdAt")
SELECT 'chg_' || p."id", p."studentId", p."enrollmentId", p."amount", p."periodFrom", p."periodTo", p."lessonsInCycle", p."nextPaymentDue", 'PAID', p."comment", p."recordedById", p."createdAt"
FROM "Payment" p;

UPDATE "Payment" p SET "chargeId" = 'chg_' || p."id";

-- CreateIndex
CREATE INDEX "Payment_chargeId_idx" ON "Payment"("chargeId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
