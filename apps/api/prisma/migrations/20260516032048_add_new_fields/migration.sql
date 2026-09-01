-- CreateEnum
CREATE TYPE "LessonCancellationReason" AS ENUM ('TEACHER', 'STUDENT', 'WEATHER', 'ILLNESS', 'OTHER');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "completedLessons" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freezeReason" TEXT,
ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "frozenUntil" TIMESTAMP(3),
ADD COLUMN     "lessonDebt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "schedulePattern" JSONB,
ADD COLUMN     "teacherCommission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLessons" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "cancellationType" "LessonCancellationReason",
ADD COLUMN     "isReplacementLesson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalLessonId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "telegram" TEXT;
