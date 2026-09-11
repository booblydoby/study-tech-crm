import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceStatus, LessonStatus, RoleName } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { isStudentEligibleForGroupLesson, isStudentEligibleForIndividualLesson } from "../common/utils/lesson-schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MarkAttendanceDto } from "./attendance.dto";

const COUNTABLE_ATTENDANCE: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.LATE];

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.attendance.findMany({
      include: { student: true, lesson: true },
      orderBy: { createdAt: "desc" }
    });
  }

  private async assertCanAccessLesson(user: AuthUser, lessonId: string) {
    if (user.role === RoleName.ADMIN) return;
    if (user.role === RoleName.TEACHER) {
      if (!user.teacherId) throw new ForbiddenException("Teacher profile is required");
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId, teacherId: user.teacherId },
        select: { id: true }
      });
      if (!lesson) throw new NotFoundException("Lesson not found");
      return;
    }
    throw new ForbiddenException("Access denied");
  }

  private async getAllowedStudentIds(lessonId: string): Promise<Set<string>> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        startsAt: true,
        studentId: true,
        groupId: true,
        type: true,
        enrollmentId: true,
        enrollment: { select: { studentId: true, startDate: true, endDate: true, breakStart: true, breakEnd: true } }
      }
    });
    if (!lesson) throw new NotFoundException("Lesson not found");

    const allowed = new Set<string>();

    if (lesson.groupId) {
      const memberships = await this.prisma.studentGroup.findMany({
        where: { groupId: lesson.groupId },
        select: { studentId: true, joinedAt: true, leftAt: true, status: true }
      });

      for (const membership of memberships) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: { studentId: membership.studentId, groupId: lesson.groupId },
          orderBy: { createdAt: "desc" },
          select: { startDate: true, endDate: true, breakStart: true, breakEnd: true }
        });
        if (isStudentEligibleForGroupLesson(lesson.startsAt, membership, enrollment)) {
          allowed.add(membership.studentId);
        }
      }
      return allowed;
    }

    const studentId = lesson.studentId ?? lesson.enrollment?.studentId;
    if (studentId) {
      const enrollment =
        lesson.enrollment ??
        (await this.prisma.enrollment.findFirst({
          where: { studentId },
          orderBy: { createdAt: "desc" },
          select: { startDate: true, endDate: true, breakStart: true, breakEnd: true }
        }));
      if (isStudentEligibleForIndividualLesson(lesson.startsAt, enrollment)) {
        allowed.add(studentId);
      }
    }

    return allowed;
  }

  private async findEnrollmentForStudent(lessonId: string, studentId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { groupId: true, subjectId: true, enrollmentId: true }
    });
    if (!lesson) return null;

    return this.prisma.enrollment.findFirst({
      where: {
        studentId,
        subjectId: lesson.subjectId,
        ...(lesson.groupId ? { groupId: lesson.groupId } : {}),
        status: { in: ["ACTIVE", "PAUSED"] }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  private async applyLessonCompletion(lessonId: string, items: MarkAttendanceDto["items"]) {
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { status: LessonStatus.COMPLETED }
    });

    for (const item of items) {
      if (!COUNTABLE_ATTENDANCE.includes(item.status)) continue;
      const enrollment = await this.findEnrollmentForStudent(lessonId, item.studentId);
      if (enrollment) {
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { completedLessons: { increment: 1 } }
        });
      }
    }
  }

  async revertLessonCompletion(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { status: true, enrollmentId: true }
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    if (lesson.status !== LessonStatus.COMPLETED) {
      throw new BadRequestException("Занятие не отмечено как проведённое");
    }

    const records = await this.prisma.attendance.findMany({ where: { lessonId } });

    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lessonId },
        data: { status: LessonStatus.SCHEDULED }
      });

      if (records.length > 0) {
        for (const record of records) {
          if (!COUNTABLE_ATTENDANCE.includes(record.status)) continue;
          const enrollment = await this.findEnrollmentForStudent(lessonId, record.studentId);
          if (enrollment && enrollment.completedLessons > 0) {
            await tx.enrollment.update({
              where: { id: enrollment.id },
              data: { completedLessons: { decrement: 1 } }
            });
          }
        }
      } else if (lesson.enrollmentId) {
        const enrollment = await tx.enrollment.findUnique({ where: { id: lesson.enrollmentId } });
        if (enrollment && enrollment.completedLessons > 0) {
          await tx.enrollment.update({
            where: { id: lesson.enrollmentId },
            data: { completedLessons: { decrement: 1 } }
          });
        }
      }
    });
  }

  async markLesson(lessonId: string, user: AuthUser, dto: MarkAttendanceDto) {
    await this.assertCanAccessLesson(user, lessonId);
    const allowedStudentIds = await this.getAllowedStudentIds(lessonId);

    for (const item of dto.items) {
      if (!allowedStudentIds.has(item.studentId)) {
        throw new BadRequestException(`Student ${item.studentId} is not part of this lesson`);
      }
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { status: true }
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    if (lesson.status === LessonStatus.CANCELLED) {
      throw new BadRequestException("Нельзя отмечать посещаемость на отменённом занятии");
    }
    if (lesson.status === LessonStatus.MOVED) {
      throw new BadRequestException("Это занятие перенесено — отметьте посещаемость на новом слоте");
    }

    const wasCompleted = lesson.status === LessonStatus.COMPLETED;

    if (wasCompleted && dto.completeLesson) {
      await this.revertLessonCompletion(lessonId);
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.attendance.upsert({
          where: { lessonId_studentId: { lessonId, studentId: item.studentId } },
          create: {
            lessonId,
            studentId: item.studentId,
            status: item.status,
            comment: item.comment,
            markedById: user.sub
          },
          update: { status: item.status, comment: item.comment, markedById: user.sub }
        })
      )
    );

    if (dto.completeLesson) {
      await this.applyLessonCompletion(lessonId, dto.items);
    }

    return this.byLesson(user, lessonId);
  }

  async byLesson(user: AuthUser, lessonId: string) {
    await this.assertCanAccessLesson(user, lessonId);
    return this.prisma.attendance.findMany({
      where: { lessonId },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } }
    });
  }

  /**
   * Удаляет посещаемость за дни, когда ученик ещё не был в группе или уже вышел.
   */
  async cleanupIneligibleGroupAttendance() {
    const records = await this.prisma.attendance.findMany({
      where: { lesson: { groupId: { not: null } } },
      select: {
        id: true,
        studentId: true,
        lesson: { select: { startsAt: true, groupId: true } }
      }
    });

    const toDelete: string[] = [];
    for (const record of records) {
      const groupId = record.lesson.groupId!;
      const membership = await this.prisma.studentGroup.findUnique({
        where: { studentId_groupId: { studentId: record.studentId, groupId } },
        select: { joinedAt: true, leftAt: true, status: true }
      });
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { studentId: record.studentId, groupId },
        orderBy: { createdAt: "desc" },
        select: { startDate: true, endDate: true, breakStart: true, breakEnd: true }
      });
      if (!membership || !isStudentEligibleForGroupLesson(record.lesson.startsAt, membership, enrollment)) {
        toDelete.push(record.id);
      }
    }

    if (toDelete.length) {
      await this.prisma.attendance.deleteMany({ where: { id: { in: toDelete } } });
    }
    return { deleted: toDelete.length };
  }

  /**
   * Проведённые занятия без записей посещаемости (старые «Проведено») — создаём PRESENT,
   * чтобы аналитика и отчёты совпадали с календарём.
   */
  async backfillCompletedLessonsWithoutAttendance() {
    await this.cleanupIneligibleGroupAttendance();

    const marker = await this.prisma.user.findFirst({
      where: { role: { name: RoleName.ADMIN } },
      select: { id: true },
      orderBy: { createdAt: "asc" }
    });
    if (!marker) return { created: 0 };

    const lessons = await this.prisma.lesson.findMany({
      where: { status: LessonStatus.COMPLETED, attendance: { none: {} } },
      select: { id: true, studentId: true }
    });

    let created = 0;
    for (const lesson of lessons) {
      const studentIds = [...(await this.getAllowedStudentIds(lesson.id))];
      if (!studentIds.length) continue;

      for (const studentId of studentIds) {
        await this.prisma.attendance.create({
          data: {
            lessonId: lesson.id,
            studentId,
            status: AttendanceStatus.PRESENT,
            markedById: marker.id
          }
        });
        created += 1;
      }
    }

    return { created };
  }

  byStudent(user: AuthUser, studentId: string) {
    if (user.role === RoleName.STUDENT && user.studentId !== studentId) {
      throw new ForbiddenException("Students can only view their own attendance");
    }
    if (user.role === RoleName.TEACHER && !user.teacherId) {
      throw new ForbiddenException("Teacher profile is required");
    }
    return this.prisma.attendance.findMany({
      where: {
        studentId,
        lesson: user.role === RoleName.TEACHER ? { teacherId: user.teacherId } : undefined
      },
      include: { lesson: { include: { group: true, subject: true } } },
      orderBy: { createdAt: "desc" }
    });
  }
}
