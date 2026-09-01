-- AlterTable: запланированный перерыв ученика по записи
ALTER TABLE "Enrollment" ADD COLUMN "breakStart" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN "breakEnd" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN "breakReason" TEXT;
