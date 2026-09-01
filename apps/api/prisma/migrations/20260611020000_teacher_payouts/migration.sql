-- CreateTable: выплаты преподавателям
CREATE TABLE "TeacherPayout" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherPayout_teacherId_idx" ON "TeacherPayout"("teacherId");
CREATE INDEX "TeacherPayout_paidAt_idx" ON "TeacherPayout"("paidAt");

ALTER TABLE "TeacherPayout" ADD CONSTRAINT "TeacherPayout_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherPayout" ADD CONSTRAINT "TeacherPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
