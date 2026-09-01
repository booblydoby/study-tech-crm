-- Добавляем флаг учёта записи в выручке/оплатах.
ALTER TABLE "Enrollment" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;
