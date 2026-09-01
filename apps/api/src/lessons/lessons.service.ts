import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AttendanceStatus,
  EnrollmentType,
  GroupStatus,
  LessonStatus,
  LessonType,
  PaymentPeriod,
  Prisma,
  RoleName
} from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import { AttendanceService } from "../attendance/attendance.service";
import {
  getLessonOccurrences,
  isEnrollmentOnBreak,
  isStudentEligibleForGroupLesson,
  isStudentEligibleForIndividualLesson,
  parseScheduleSlots,
  resolveEnrollmentSchedulePattern,
  type LessonOccurrence
} from "../common/utils/lesson-schedule";
import { PrismaService } from "../prisma/prisma.service";
import { CancelLessonDto, CancelLessonWithOptionsDto, CreateLessonDto, RescheduleLessonDto, UpdateLessonDto, LessonCancellationReason } from "./lessons.dto";

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService
  ) {}

  private visibleLessonWhere(user: AuthUser): Prisma.LessonWhereInput {
    if (user.role === RoleName.ADMIN) return {};
    if (user.role === RoleName.TEACHER) {
      if (!user.teacherId) throw new ForbiddenException("Teacher profile is required");
      return { teacherId: user.teacherId };
    }
    if (user.role === RoleName.STUDENT) {
      if (!user.studentId) throw new ForbiddenException("Student profile is required");
      return {
        OR: [
          { studentId: user.studentId },
          { enrollment: { studentId: user.studentId } },
          { group: { students: { some: { studentId: user.studentId, status: "ACTIVE" } } } }
        ]
      };
    }
    throw new ForbiddenException("Unsupported role");
  }

  private assertTeacherCanUseTeacherId(user: AuthUser, teacherId?: string) {
    if (user.role === RoleName.TEACHER && teacherId && teacherId !== user.teacherId) {
      throw new ForbiddenException("Teachers can only manage their own lessons");
    }
  }

  private async resolveStudentLessonScope(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true, groupId: true, type: true }
    });

    const groupIds = new Set<string>();
    const individualEnrollmentIds: string[] = [];
    for (const enrollment of enrollments) {
      if (enrollment.type === EnrollmentType.GROUP && enrollment.groupId) {
        groupIds.add(enrollment.groupId);
      } else if (enrollment.type === EnrollmentType.INDIVIDUAL) {
        individualEnrollmentIds.push(enrollment.id);
      }
    }

    const memberships = await this.prisma.studentGroup.findMany({
      where: { studentId, status: "ACTIVE" },
      select: { groupId: true }
    });
    for (const membership of memberships) groupIds.add(membership.groupId);

    return {
      groupIds: [...groupIds],
      individualEnrollmentIds,
      hasIndividual: individualEnrollmentIds.length > 0
    };
  }

  private async buildStudentLessonFilter(studentId: string): Promise<Prisma.LessonWhereInput> {
    const { groupIds, individualEnrollmentIds, hasIndividual } = await this.resolveStudentLessonScope(studentId);
    const or: Prisma.LessonWhereInput[] = [];
    if (groupIds.length) or.push({ groupId: { in: groupIds } });
    if (hasIndividual) {
      or.push({ studentId });
      if (individualEnrollmentIds.length) {
        or.push({ enrollmentId: { in: individualEnrollmentIds } });
      }
    }
    return or.length ? { OR: or } : { id: "impossible" };
  }

  private async getStudentCycleWindows(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true }
    });

    const windows: Array<{ from: Date; to: Date; enrollmentId: string }> = [];
    for (const enrollment of enrollments) {
      const charge = await this.prisma.charge.findFirst({
        where: { studentId, enrollmentId: enrollment.id },
        orderBy: { periodFrom: "desc" }
      });
      if (charge) {
        windows.push({
          from: charge.periodFrom,
          to: charge.periodTo,
          enrollmentId: enrollment.id
        });
      }
    }
    return windows;
  }

  private cycleOccurrencesForEnrollment(
    enrollment: {
      paymentPeriod: PaymentPeriod;
      schedulePattern: unknown;
      breakStart: Date | null;
      breakEnd: Date | null;
      group: { schedulePattern: unknown } | null;
      type: EnrollmentType;
    },
    charge: { periodFrom: Date; periodTo: Date; lessonsInCycle: number | null }
  ): LessonOccurrence[] {
    const pattern = resolveEnrollmentSchedulePattern(enrollment);
    if (!pattern || !parseScheduleSlots(pattern).length) return [];

    try {
      if (enrollment.paymentPeriod === PaymentPeriod.PER_LESSON && charge.lessonsInCycle && charge.lessonsInCycle > 0) {
        return getLessonOccurrences(pattern, charge.periodFrom, charge.lessonsInCycle).filter(
          (occ) => !isEnrollmentOnBreak(enrollment, occ.startsAt)
        );
      }

      return getLessonOccurrences(pattern, charge.periodFrom, 200)
        .filter((occ) => occ.startsAt <= charge.periodTo && !isEnrollmentOnBreak(enrollment, occ.startsAt));
    } catch {
      return [];
    }
  }

  private async lessonExistsAt(groupId: string | null, studentId: string | null, enrollmentId: string | null, startsAt: Date) {
    const window = {
      gte: new Date(startsAt.getTime() - 60_000),
      lte: new Date(startsAt.getTime() + 60_000)
    };

    if (groupId) {
      return this.prisma.lesson.findFirst({
        where: { groupId, startsAt: window }
      });
    }

    if (enrollmentId) {
      const byEnrollment = await this.prisma.lesson.findFirst({
        where: { enrollmentId, startsAt: window }
      });
      if (byEnrollment) return byEnrollment;
    }

    if (studentId) {
      return this.prisma.lesson.findFirst({
        where: { studentId, startsAt: window }
      });
    }

    return null;
  }

  private async ensureGroupLessonsAtOccurrences(
    groupId: string,
    enrollmentId: string | undefined,
    occurrences: LessonOccurrence[]
  ) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { teachers: true }
    });
    if (!group || group.status !== GroupStatus.ACTIVE || !group.teachers.length) return;

    const teacherId = group.teachers[0].teacherId;

    for (const { startsAt, duration } of occurrences) {
      const exists = await this.lessonExistsAt(groupId, null, null, startsAt);
      if (exists) continue;

      await this.prisma.lesson.create({
        data: {
          type: LessonType.GROUP,
          groupId: group.id,
          teacherId,
          subjectId: group.subjectId,
          enrollmentId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60_000)
        }
      });
    }
  }

  private async ensureIndividualLessonsAtOccurrences(
    enrollment: {
      id: string;
      studentId: string;
      teacherId: string;
      subjectId: string;
      groupId: string | null;
    },
    occurrences: LessonOccurrence[]
  ) {
    for (const { startsAt, duration } of occurrences) {
      if (enrollment.groupId) {
        const groupLesson = await this.lessonExistsAt(enrollment.groupId, null, null, startsAt);
        if (groupLesson) continue;
      }

      const exists = await this.lessonExistsAt(null, enrollment.studentId, enrollment.id, startsAt);
      if (exists) continue;

      await this.prisma.lesson.create({
        data: {
          type: LessonType.INDIVIDUAL,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          teacherId: enrollment.teacherId,
          subjectId: enrollment.subjectId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60_000)
        }
      });
    }
  }

  private async ensureLessonsForStudentCycles(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: { group: true }
    });

    for (const enrollment of enrollments) {
      const charge = await this.prisma.charge.findFirst({
        where: { studentId, enrollmentId: enrollment.id },
        orderBy: { periodFrom: "desc" }
      });
      if (!charge) continue;

      const occurrences = this.cycleOccurrencesForEnrollment(enrollment, charge);
      if (!occurrences.length) continue;

      if (enrollment.type === EnrollmentType.GROUP && enrollment.groupId) {
        await this.ensureGroupLessonsAtOccurrences(enrollment.groupId, enrollment.id, occurrences);
      } else if (enrollment.type === EnrollmentType.INDIVIDUAL) {
        await this.ensureIndividualLessonsAtOccurrences(enrollment, occurrences);
      }
    }
  }

  private dedupeStudentLessons<T extends { id: string; startsAt: Date; subjectId: string; status: string; type: string }>(
    lessons: T[]
  ): T[] {
    const bySlot = new Map<string, T>();
    for (const lesson of lessons) {
      const slotKey = `${Math.floor(lesson.startsAt.getTime() / 60_000)}_${lesson.subjectId}`;
      const existing = bySlot.get(slotKey);
      if (!existing) {
        bySlot.set(slotKey, lesson);
        continue;
      }
      const rank = (item: T) => {
        if (item.status === LessonStatus.COMPLETED) return 3;
        if (item.type === LessonType.GROUP) return 2;
        return 1;
      };
      if (rank(lesson) > rank(existing)) bySlot.set(slotKey, lesson);
    }
    return [...bySlot.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  private async filterLessonsForStudentView<T extends {
    startsAt: Date;
    groupId: string | null;
    enrollmentId: string | null;
    studentId: string | null;
    type: string;
  }>(studentId: string, lessons: T[]): Promise<T[]> {
    const [enrollments, memberships] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId },
        select: {
          id: true,
          groupId: true,
          type: true,
          startDate: true,
          endDate: true,
          breakStart: true,
          breakEnd: true
        }
      }),
      this.prisma.studentGroup.findMany({
        where: { studentId },
        select: { groupId: true, joinedAt: true, leftAt: true, status: true }
      })
    ]);

    return lessons.filter((lesson) => {
      if (lesson.groupId) {
        const membership = memberships.find((item) => item.groupId === lesson.groupId);
        if (!membership) return false;
        const enrollment = enrollments.find((item) => item.groupId === lesson.groupId) ?? null;
        return isStudentEligibleForGroupLesson(lesson.startsAt, membership, enrollment);
      }

      if (lesson.type === LessonType.INDIVIDUAL) {
        const enrollment =
          enrollments.find((item) => item.id === lesson.enrollmentId) ??
          enrollments.find((item) => item.type === EnrollmentType.INDIVIDUAL) ??
          null;
        return isStudentEligibleForIndividualLesson(lesson.startsAt, enrollment);
      }

      return true;
    });
  }

  async findAll(user: AuthUser, from?: string, to?: string, teacherId?: string, studentId?: string, groupId?: string) {
    let studentFilter: Prisma.LessonWhereInput | undefined;
    let cycleFilter: Prisma.LessonWhereInput | undefined;

    if (studentId) {
      await this.ensureLessonsForStudentCycles(studentId);
      studentFilter = await this.buildStudentLessonFilter(studentId);

      const cycleWindows = await this.getStudentCycleWindows(studentId);
      if (cycleWindows.length) {
        cycleFilter = {
          OR: cycleWindows.map((window) => ({
            startsAt: { gte: window.from, lte: window.to }
          }))
        };
      } else {
        cycleFilter = { id: "impossible" };
      }
    }

    const lessons = await this.prisma.lesson.findMany({
      where: {
        AND: [
          this.visibleLessonWhere(user),
          ...(studentFilter ? [studentFilter] : []),
          ...(cycleFilter ? [cycleFilter] : []),
          {
            teacherId: user.role === RoleName.TEACHER ? user.teacherId : teacherId,
            groupId,
            startsAt: {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined
            }
          }
        ]
      },
      include: { enrollment: { include: { student: true } }, group: true, student: true, teacher: true, subject: true },
      orderBy: { startsAt: "asc" }
    });

    if (studentId) {
      const deduped = this.dedupeStudentLessons(lessons);
      return this.filterLessonsForStudentView(studentId, deduped);
    }

    return lessons;
  }
  async findOne(user: AuthUser, id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, AND: [this.visibleLessonWhere(user)] },
      include: { enrollment: true, group: true, student: true, teacher: true, subject: true, attendance: true }
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    return lesson;
  }
  async create(user: AuthUser, dto: CreateLessonDto) {
    this.assertTeacherCanUseTeacherId(user, dto.teacherId);
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) throw new BadRequestException("Lesson end must be after start");
    const type = dto.type ?? (dto.studentId ? LessonType.INDIVIDUAL : LessonType.GROUP);
    if (type === LessonType.GROUP && !dto.groupId) throw new BadRequestException("groupId is required for group lesson");
    if (type === LessonType.INDIVIDUAL && !dto.studentId) throw new BadRequestException("studentId is required for individual lesson");
    return this.prisma.lesson.create({
      data: {
        type,
        enrollmentId: dto.enrollmentId,
        groupId: type === LessonType.GROUP ? dto.groupId : undefined,
        studentId: type === LessonType.INDIVIDUAL ? dto.studentId : undefined,
        teacherId: user.role === RoleName.TEACHER ? user.teacherId! : dto.teacherId,
        subjectId: dto.subjectId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt)
      }
    });
  }
  async update(user: AuthUser, id: string, dto: UpdateLessonDto) {
    await this.findOne(user, id);
    this.assertTeacherCanUseTeacherId(user, dto.teacherId);
    return this.prisma.lesson.update({
      where: { id },
      data: {
        type: dto.type,
        enrollmentId: dto.enrollmentId,
        groupId: dto.type === LessonType.INDIVIDUAL ? null : dto.groupId,
        studentId: dto.type === LessonType.GROUP ? null : dto.studentId,
        teacherId: user.role === RoleName.TEACHER ? undefined : dto.teacherId,
        subjectId: dto.subjectId,
        status: dto.status,
        cancellationReason: dto.cancellationReason,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined
      }
    });
  }
  async cancel(user: AuthUser, id: string, dto: CancelLessonDto) {
    const lesson = await this.findOne(user, id);
    
    // Update lesson status
    const updatedLesson = await this.prisma.lesson.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationReason: dto.reason,
        cancellationType: dto.cancellationType
      },
      include: { enrollment: true, student: true, teacher: true, subject: true }
    });

    // If cancelled by teacher and has enrollment, add to lesson debt
    if (dto.cancellationType === LessonCancellationReason.TEACHER && lesson.enrollmentId) {
      await this.prisma.enrollment.update({
        where: { id: lesson.enrollmentId },
        data: {
          lessonDebt: { increment: 1 }
        }
      });
    }

    return updatedLesson;
  }

  async cancelWithOptions(user: AuthUser, id: string, dto: CancelLessonWithOptionsDto) {
    const lesson = await this.findOne(user, id);

    if (lesson.status === LessonStatus.CANCELLED) {
      throw new BadRequestException("Занятие уже отменено");
    }

    await this.prisma.lesson.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancellationReason: dto.reason,
        cancellationType: dto.cancellationType
      }
    });

    let replacement = null;

    if (dto.action === "add_debt" && lesson.enrollmentId) {
      await this.prisma.enrollment.update({
        where: { id: lesson.enrollmentId },
        data: { lessonDebt: { increment: 1 } }
      });
    } else if (dto.action === "reschedule" && dto.newStartsAt && dto.newEndsAt) {
      replacement = await this.createReplacementLesson(
        lesson,
        new Date(dto.newStartsAt),
        new Date(dto.newEndsAt)
      );
    } else if (dto.action === "adjust_payment" && lesson.enrollmentId) {
      await this.prisma.enrollment.update({
        where: { id: lesson.enrollmentId },
        data: { lessonDebt: { increment: 1 } }
      });
    }

    return {
      lesson: await this.findOne(user, id),
      replacement: replacement
        ? {
            id: replacement.id,
            startsAt: replacement.startsAt.toISOString(),
            endsAt: replacement.endsAt.toISOString(),
            status: replacement.status
          }
        : null
    };
  }

  async createReplacement(user: AuthUser, id: string, dto: RescheduleLessonDto) {
    const lesson = await this.findOne(user, id);
    if (lesson.status !== LessonStatus.CANCELLED) {
      throw new BadRequestException("Перенос можно создать только для отменённого занятия");
    }

    const replacement = await this.createReplacementLesson(
      lesson,
      new Date(dto.newStartsAt),
      new Date(dto.newEndsAt)
    );

    return {
      replacement: {
        id: replacement.id,
        startsAt: replacement.startsAt.toISOString(),
        endsAt: replacement.endsAt.toISOString(),
        status: replacement.status
      }
    };
  }

  private createReplacementLesson(
    lesson: {
      id: string;
      type: LessonType;
      enrollmentId: string | null;
      groupId: string | null;
      studentId: string | null;
      teacherId: string;
      subjectId: string;
    },
    startsAt: Date,
    endsAt: Date
  ) {
    return this.prisma.lesson.create({
      data: {
        type: lesson.type,
        enrollmentId: lesson.enrollmentId,
        groupId: lesson.groupId,
        studentId: lesson.studentId,
        teacherId: lesson.teacherId,
        subjectId: lesson.subjectId,
        startsAt,
        endsAt,
        isReplacementLesson: true,
        originalLessonId: lesson.id
      }
    });
  }
  move(user: AuthUser, id: string, dto: UpdateLessonDto) {
    return this.update(user, id, { ...dto, status: "MOVED" });
  }
  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    return this.prisma.lesson.delete({ where: { id } });
  }

  async markCompleted(user: AuthUser, id: string) {
    const roster = await this.getLessonRoster(user, id);

    if (roster.lesson.status === LessonStatus.COMPLETED) {
      throw new BadRequestException("Занятие уже проведено. Используйте «Изменить посещаемость» или «Отменить проведение».");
    }

    let items = roster.students.map((student) => ({
      studentId: student.studentId,
      status: AttendanceStatus.PRESENT
    }));

    if (!items.length) {
      const lesson = await this.findOne(user, id);
      const studentId = lesson.studentId ?? lesson.enrollment?.studentId;
      if (!studentId) {
        throw new BadRequestException("Не удалось определить студента для занятия");
      }
      items = [{ studentId, status: AttendanceStatus.PRESENT }];
    }

    await this.attendance.markLesson(id, user, { items, completeLesson: true });
    return this.findOne(user, id);
  }

  async reopenLesson(user: AuthUser, id: string) {
    await this.findOne(user, id);
    await this.attendance.revertLessonCompletion(id);
    return this.findOne(user, id);
  }

  async getLessonRoster(user: AuthUser, id: string) {
    const lesson = await this.findOne(user, id);

    type RosterStudent = {
      studentId: string;
      fullName: string;
      avatarId: number;
      enrollmentId: string | null;
      isFrozen: boolean;
      frozenUntil: string | null;
      freezeReason: string | null;
    };

    const students: RosterStudent[] = [];

    if (lesson.groupId) {
      const memberships = await this.prisma.studentGroup.findMany({
        where: { groupId: lesson.groupId, status: "ACTIVE" },
        include: { student: true }
      });

      for (const membership of memberships) {
        const enrollment = await this.prisma.enrollment.findFirst({
          where: { studentId: membership.studentId, groupId: lesson.groupId },
          orderBy: { createdAt: "desc" }
        });
        if (!isStudentEligibleForGroupLesson(lesson.startsAt, membership, enrollment)) {
          continue;
        }
        const frozenUntil = enrollment?.frozenUntil ?? null;
        const isFrozen = Boolean(
          enrollment?.status === "PAUSED" && frozenUntil && frozenUntil.getTime() > Date.now()
        );
        students.push({
          studentId: membership.student.id,
          fullName: membership.student.fullName,
          avatarId: membership.student.avatarId,
          enrollmentId: enrollment?.id ?? null,
          isFrozen,
          frozenUntil: frozenUntil?.toISOString() ?? null,
          freezeReason: enrollment?.freezeReason ?? null
        });
      }
    } else {
      const studentId = lesson.studentId ?? lesson.enrollment?.studentId;
      if (studentId) {
        const student = await this.prisma.student.findUnique({ where: { id: studentId } });
        const enrollment = lesson.enrollmentId
          ? await this.prisma.enrollment.findUnique({ where: { id: lesson.enrollmentId } })
          : await this.prisma.enrollment.findFirst({
              where: { studentId, subjectId: lesson.subjectId },
              orderBy: { createdAt: "desc" }
            });
        if (!isStudentEligibleForIndividualLesson(lesson.startsAt, enrollment)) {
          // Ученик ещё не начал занятия на эту дату.
        } else {
        const frozenUntil = enrollment?.frozenUntil ?? null;
        students.push({
          studentId,
          fullName: student?.fullName ?? "Студент",
          avatarId: student?.avatarId ?? 1,
          enrollmentId: enrollment?.id ?? null,
          isFrozen: Boolean(enrollment?.status === "PAUSED" && frozenUntil && frozenUntil.getTime() > Date.now()),
          frozenUntil: frozenUntil?.toISOString() ?? null,
          freezeReason: enrollment?.freezeReason ?? null
        });
        }
      }
    }

    const attendance = await this.prisma.attendance.findMany({
      where: { lessonId: id },
      include: { student: true }
    });

    const replacementLessons =
      lesson.status === LessonStatus.CANCELLED
        ? await this.prisma.lesson.findMany({
            where: { originalLessonId: id },
            select: { id: true, startsAt: true, endsAt: true, status: true },
            orderBy: { startsAt: "asc" }
          })
        : [];

    const originalLesson = lesson.originalLessonId
      ? await this.prisma.lesson.findUnique({
          where: { id: lesson.originalLessonId },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            cancellationReason: true
          }
        })
      : null;

    return {
      lesson: {
        id: lesson.id,
        status: lesson.status,
        type: lesson.type,
        startsAt: lesson.startsAt.toISOString(),
        groupName: lesson.group?.name ?? null,
        subjectName: lesson.subject.name,
        cancellationReason: lesson.cancellationReason,
        isReplacementLesson: lesson.isReplacementLesson,
        originalLessonId: lesson.originalLessonId
      },
      students,
      attendance,
      replacementLessons: replacementLessons.map((item) => ({
        id: item.id,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        status: item.status
      })),
      originalLesson: originalLesson
        ? {
            id: originalLesson.id,
            startsAt: originalLesson.startsAt.toISOString(),
            endsAt: originalLesson.endsAt.toISOString(),
            status: originalLesson.status,
            cancellationReason: originalLesson.cancellationReason
          }
        : null
    };
  }

  async clearFutureGroupLessons(groupId?: string) {
    const from = new Date();
    const lessons = await this.prisma.lesson.findMany({
      where: {
        type: LessonType.GROUP,
        status: LessonStatus.SCHEDULED,
        startsAt: { gte: from },
        ...(groupId ? { groupId } : {})
      },
      select: { id: true }
    });

    const ids = lessons.map((lesson) => lesson.id);
    if (!ids.length) return { deleted: 0 };

    await this.prisma.$transaction([
      this.prisma.attendance.deleteMany({ where: { lessonId: { in: ids } } }),
      this.prisma.lesson.deleteMany({ where: { id: { in: ids } } })
    ]);

    return { deleted: ids.length };
  }

  private async clearFutureIndividualLessons() {
    const from = new Date();
    const lessons = await this.prisma.lesson.findMany({
      where: { type: LessonType.INDIVIDUAL, status: LessonStatus.SCHEDULED, startsAt: { gte: from } },
      select: { id: true }
    });
    const ids = lessons.map((lesson) => lesson.id);
    if (!ids.length) return;
    await this.prisma.$transaction([
      this.prisma.attendance.deleteMany({ where: { lessonId: { in: ids } } }),
      this.prisma.lesson.deleteMany({ where: { id: { in: ids } } })
    ]);
  }

  async generateFromGroups(weeks = 4, replaceFuture = false) {
    const from = new Date();

    if (replaceFuture) {
      await this.clearFutureGroupLessons();
      await this.clearFutureIndividualLessons();
    }
    const to = new Date();
    to.setDate(to.getDate() + weeks * 7);

    const groups = await this.prisma.group.findMany({
      where: { status: GroupStatus.ACTIVE },
      include: {
        subject: true,
        teachers: true,
        enrollments: { where: { status: "ACTIVE" }, take: 1 }
      }
    });

    let created = 0;
    let skipped = 0;
    const issues: Array<{ groupName: string; reason: string }> = [];

    for (const group of groups) {
      const slots = parseScheduleSlots(group.schedulePattern);
      if (!slots.length) {
        skipped++;
        issues.push({ groupName: group.name, reason: "нет расписания (дни и время)" });
        continue;
      }
      if (!group.teachers.length) {
        skipped++;
        issues.push({ groupName: group.name, reason: "не назначен преподаватель" });
        continue;
      }

      const teacherId = group.teachers[0].teacherId;
      const enrollmentId = group.enrollments[0]?.id;

      let occurrences: LessonOccurrence[];
      try {
        occurrences = getLessonOccurrences(group.schedulePattern, from, 200).filter((occ) => occ.startsAt <= to);
      } catch (error) {
        skipped++;
        issues.push({
          groupName: group.name,
          reason: error instanceof Error ? error.message : "ошибка расчёта дат"
        });
        continue;
      }

      for (const { startsAt, duration } of occurrences) {
        const endsAt = new Date(startsAt.getTime() + duration * 60_000);

        const exists = await this.prisma.lesson.findFirst({
          where: {
            groupId: group.id,
            startsAt: {
              gte: new Date(startsAt.getTime() - 60_000),
              lte: new Date(startsAt.getTime() + 60_000)
            }
          }
        });
        if (exists) {
          skipped++;
          continue;
        }

        await this.prisma.lesson.create({
          data: {
            type: LessonType.GROUP,
            groupId: group.id,
            teacherId,
            subjectId: group.subjectId,
            enrollmentId,
            startsAt,
            endsAt
          }
        });
        created++;
      }
    }

    // Индивидуальные занятия: генерируем по расписанию активных индивидуальных записей.
    const individualEnrollments = await this.prisma.enrollment.findMany({
      where: { type: "INDIVIDUAL", status: "ACTIVE" },
      include: { subject: true, teacher: true, student: true }
    });

    for (const enrollment of individualEnrollments) {
      const slots = parseScheduleSlots(enrollment.schedulePattern);
      const label = `${enrollment.student.fullName} (индив.)`;
      if (!slots.length) {
        skipped++;
        issues.push({ groupName: label, reason: "нет расписания (дни и время)" });
        continue;
      }

      let occurrences: LessonOccurrence[];
      try {
        occurrences = getLessonOccurrences(enrollment.schedulePattern, from, 200).filter(
          (occ) => occ.startsAt <= to && !isEnrollmentOnBreak(enrollment, occ.startsAt)
        );
      } catch (error) {
        skipped++;
        issues.push({
          groupName: label,
          reason: error instanceof Error ? error.message : "ошибка расчёта дат"
        });
        continue;
      }

      for (const { startsAt, duration } of occurrences) {
        const endsAt = new Date(startsAt.getTime() + duration * 60_000);

        const exists = await this.prisma.lesson.findFirst({
          where: {
            type: LessonType.INDIVIDUAL,
            studentId: enrollment.studentId,
            startsAt: {
              gte: new Date(startsAt.getTime() - 60_000),
              lte: new Date(startsAt.getTime() + 60_000)
            }
          }
        });
        if (exists) {
          skipped++;
          continue;
        }

        await this.prisma.lesson.create({
          data: {
            type: LessonType.INDIVIDUAL,
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            teacherId: enrollment.teacherId,
            subjectId: enrollment.subjectId,
            startsAt,
            endsAt
          }
        });
        created++;
      }
    }

    return { created, skipped, weeks, issues };
  }
}
