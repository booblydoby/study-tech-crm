import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EnrollmentType, PaymentPeriod, Prisma, RoleName } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import {
  advanceDueDateByLessons,
  countLessonsInRange,
  getLessonOccurrences,
  getStartOfDayInAppTz,
  isEnrollmentOnBreak,
  resolveEnrollmentSchedulePattern,
  type LessonOccurrence
} from "../common/utils/lesson-schedule";
import { toInputJson } from "../common/utils/prisma-json";
import { syncOpenChargesForEnrollment } from "../common/utils/charge-sync";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddLessonDebtDto,
  CreateEnrollmentDto,
  FreezeEnrollmentDto,
  StartBreakDto,
  UnfreezeEnrollmentDto,
  UpdateEnrollmentDto,
  UpdateScheduleDto
} from "./enrollments.dto";

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private visibleEnrollmentWhere(user: AuthUser): Prisma.EnrollmentWhereInput {
    if (user.role === RoleName.ADMIN) return {};
    if (user.role === RoleName.TEACHER) {
      if (!user.teacherId) throw new ForbiddenException("Teacher profile is required");
      return { teacherId: user.teacherId };
    }
    if (user.role === RoleName.STUDENT) {
      if (!user.studentId) throw new ForbiddenException("Student profile is required");
      return { studentId: user.studentId };
    }
    throw new ForbiddenException("Unsupported role");
  }

  findAll(user: AuthUser, studentId?: string, teacherId?: string) {
    return this.prisma.enrollment.findMany({
      where: {
        AND: [
          this.visibleEnrollmentWhere(user),
          {
            studentId: user.role === RoleName.STUDENT ? user.studentId : studentId,
            teacherId: user.role === RoleName.TEACHER ? user.teacherId : teacherId
          }
        ]
      },
      include: { student: true, subject: true, teacher: true, group: true, payments: { orderBy: { paidAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(userOrId: AuthUser | string, maybeId?: string) {
    const user = typeof userOrId === "string" ? undefined : userOrId;
    const id = typeof userOrId === "string" ? userOrId : maybeId!;
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, ...(user ? { AND: [this.visibleEnrollmentWhere(user)] } : {}) },
      include: { student: true, subject: true, teacher: true, group: true, payments: { orderBy: { paidAt: "desc" } }, lessons: { orderBy: { startsAt: "asc" } } }
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    return enrollment;
  }

  async create(dto: CreateEnrollmentDto) {
    if (dto.type === EnrollmentType.GROUP && !dto.groupId) {
      throw new BadRequestException("groupId is required for group enrollment");
    }
    if (dto.type === EnrollmentType.INDIVIDUAL && dto.groupId) {
      throw new BadRequestException("Individual enrollment must not have groupId");
    }

    // If group enrollment, inherit group properties
    let subjectId = dto.subjectId;
    let teacherId = dto.teacherId;
    let price = dto.price;
    let schedulePattern: unknown = dto.schedulePattern;
    let totalLessons = dto.totalLessons;

    if (dto.type === EnrollmentType.GROUP && dto.groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
        include: { teachers: true }
      });

      if (group) {
        // Inherit subject from group if not explicitly set
        if (!dto.subjectId) subjectId = group.subjectId;
        // Inherit teacher from group's first teacher if not explicitly set
        if (!dto.teacherId && group.teachers.length > 0) {
          teacherId = group.teachers[0].teacherId;
        }
        // Inherit price from group's monthlyPrice if not explicitly set
        if (!dto.price) price = group.monthlyPrice;
        // Inherit schedule pattern from group if not explicitly set
        if (!dto.schedulePattern && group.schedulePattern) {
          schedulePattern = group.schedulePattern;
        }
      }
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: dto.studentId,
        subjectId,
        teacherId,
        groupId: dto.groupId,
        type: dto.type,
        price,
        teacherCommission: dto.teacherCommission ?? 0,
        paymentPeriod: dto.paymentPeriod ?? "MONTHLY",
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        schedulePattern: toInputJson(schedulePattern),
        totalLessons
      },
      include: { student: true, subject: true, teacher: true, group: true }
    });

    if (dto.type === EnrollmentType.GROUP && dto.groupId) {
      // Also sync the StudentGroup price with enrollment price
      await this.prisma.studentGroup.upsert({
        where: { studentId_groupId: { studentId: dto.studentId, groupId: dto.groupId } },
        create: { studentId: dto.studentId, groupId: dto.groupId, price },
        update: { status: "ACTIVE", leftAt: null, price }
      });
    }

    return enrollment;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    const enrollment = await this.findOne(id);
    if (dto.type === EnrollmentType.INDIVIDUAL && dto.groupId) {
      throw new BadRequestException("Individual enrollment must not have groupId");
    }

    const data: Prisma.EnrollmentUpdateInput = {};
    if (dto.subjectId !== undefined) data.subject = { connect: { id: dto.subjectId } };
    if (dto.teacherId !== undefined) data.teacher = { connect: { id: dto.teacherId } };
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.billable !== undefined) data.billable = dto.billable;
    if (dto.teacherCommission !== undefined) data.teacherCommission = dto.teacherCommission;
    if (dto.paymentPeriod !== undefined) data.paymentPeriod = dto.paymentPeriod;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.schedulePattern !== undefined) data.schedulePattern = toInputJson(dto.schedulePattern);
    if (dto.totalLessons !== undefined) data.totalLessons = dto.totalLessons;
    if (dto.completedLessons !== undefined) data.completedLessons = dto.completedLessons;
    if (dto.lessonDebt !== undefined) data.lessonDebt = dto.lessonDebt;
    if (dto.type === EnrollmentType.INDIVIDUAL) {
      data.group = { disconnect: true };
    } else if (dto.groupId !== undefined) {
      data.group = dto.groupId ? { connect: { id: dto.groupId } } : { disconnect: true };
    }

    const updated = await this.prisma.enrollment.update({
      where: { id },
      data,
      include: { student: true, subject: true, teacher: true, group: true }
    });

    if (dto.price !== undefined && updated.type === EnrollmentType.GROUP && updated.groupId) {
      await this.prisma.studentGroup.updateMany({
        where: { studentId: updated.studentId, groupId: updated.groupId, status: "ACTIVE" },
        data: { price: dto.price }
      });
    }

    if (dto.startDate !== undefined && updated.groupId) {
      const startDate = new Date(dto.startDate);
      await this.prisma.studentGroup.updateMany({
        where: { studentId: updated.studentId, groupId: updated.groupId },
        data: { joinedAt: startDate }
      });
      await this.prisma.attendance.deleteMany({
        where: {
          studentId: updated.studentId,
          lesson: { groupId: updated.groupId, startsAt: { lt: startDate } }
        }
      });
    }

    if (dto.price !== undefined) {
      await syncOpenChargesForEnrollment(this.prisma, id, dto.price);
    }

    return updated;
  }

  /** Обновляет персональное расписание индивидуальной записи и пересоздаёт будущие занятия. */
  async updateSchedule(user: AuthUser, id: string, dto: UpdateScheduleDto) {
    const enrollment = await this.findOne(user, id);
    if (user.role === RoleName.TEACHER && enrollment.teacherId !== user.teacherId) {
      throw new ForbiddenException("Можно менять расписание только своих учеников");
    }
    if (enrollment.type !== EnrollmentType.INDIVIDUAL) {
      throw new BadRequestException("Менять персональное расписание можно только у индивидуальных записей");
    }

    const cleaned = (dto.slots ?? []).filter((slot) => slot.daysOfWeek?.length && slot.time);
    if (!cleaned.length) {
      throw new BadRequestException("Укажите хотя бы один день и время");
    }

    const schedulePattern = { slots: cleaned };
    const now = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 28);

    let occurrences: LessonOccurrence[] = [];
    try {
      occurrences = getLessonOccurrences(schedulePattern, now, 200).filter((occ) => occ.startsAt <= to);
    } catch {
      occurrences = [];
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id },
        data: { schedulePattern: toInputJson(schedulePattern) }
      });

      // Удаляем только будущие незавершённые занятия — прошедшие остаются в истории.
      await tx.lesson.deleteMany({
        where: {
          enrollmentId: id,
          startsAt: { gte: now },
          status: "SCHEDULED"
        }
      });

      for (const { startsAt, duration } of occurrences) {
        await tx.lesson.create({
          data: {
            type: "INDIVIDUAL",
            studentId: enrollment.studentId,
            enrollmentId: id,
            teacherId: enrollment.teacherId,
            subjectId: enrollment.subjectId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + duration * 60_000)
          }
        });
      }

      return tx.enrollment.findUnique({
        where: { id },
        include: { student: true, subject: true, teacher: true, group: true }
      });
    });
  }

  async remove(id: string) {
    const enrollment = await this.findOne(id);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.enrollment.update({
        where: { id },
        data: { status: "CANCELLED", endDate: now }
      });

      // Для групповой записи синхронно убираем студента из состава группы,
      // чтобы не оставалось рассинхрона (запись активна, но в группе его нет, или наоборот).
      if (enrollment.type === EnrollmentType.GROUP && enrollment.groupId) {
        await tx.studentGroup.updateMany({
          where: { studentId: enrollment.studentId, groupId: enrollment.groupId, status: "ACTIVE" },
          data: { status: "LEFT", leftAt: now }
        });
        await tx.attendance.deleteMany({
          where: {
            studentId: enrollment.studentId,
            lesson: { groupId: enrollment.groupId, startsAt: { gte: now }, status: "SCHEDULED" }
          }
        });
      }

      return updated;
    });
  }

  async freeze(user: AuthUser, id: string, dto: FreezeEnrollmentDto) {
    const enrollment = await this.findOne(user, id);
    const freezeUntil = new Date(dto.frozenUntil);
    const now = new Date();
    const diffDays = Math.ceil((freezeUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      throw new BadRequestException("Freeze period must be at least 1 day");
    }

    const schedulePattern = resolveEnrollmentSchedulePattern(enrollment);
    const missedLessons =
      schedulePattern && enrollment.paymentPeriod === PaymentPeriod.PER_LESSON
        ? countLessonsInRange(schedulePattern, now, freezeUntil)
        : 0;

    const futureLessons = await this.prisma.lesson.findMany({
      where: {
        enrollmentId: id,
        startsAt: { gte: now },
        status: "SCHEDULED"
      }
    });

    const latestPayment = await this.prisma.payment.findFirst({
      where: { enrollmentId: id },
      orderBy: { paidAt: "desc" }
    });

    const paymentShift = {
      missedLessons,
      previousNextPaymentDue: null as string | null,
      newNextPaymentDue: null as string | null
    };

    await this.prisma.$transaction(async (tx) => {
      for (const lesson of futureLessons) {
        await tx.lesson.update({
          where: { id: lesson.id },
          data: {
            startsAt: new Date(lesson.startsAt.getTime() + diffDays * 24 * 60 * 60 * 1000),
            endsAt: new Date(lesson.endsAt.getTime() + diffDays * 24 * 60 * 60 * 1000)
          }
        });
      }

      await tx.enrollment.update({
        where: { id },
        data: {
          frozenAt: now,
          frozenUntil: freezeUntil,
          freezeReason: dto.reason,
          status: "PAUSED"
        }
      });

      if (latestPayment) {
        const anchor = latestPayment.nextPaymentDue ?? latestPayment.periodTo;
        paymentShift.previousNextPaymentDue = anchor.toISOString();

        if (enrollment.paymentPeriod === PaymentPeriod.PER_LESSON && schedulePattern && missedLessons > 0) {
          const newDue = advanceDueDateByLessons(schedulePattern, anchor, missedLessons);
          paymentShift.newNextPaymentDue = newDue.toISOString();
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: { nextPaymentDue: newDue }
          });
        } else if (enrollment.paymentPeriod === PaymentPeriod.MONTHLY) {
          const newDue = new Date(anchor.getTime() + (freezeUntil.getTime() - now.getTime()));
          paymentShift.newNextPaymentDue = newDue.toISOString();
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: { nextPaymentDue: newDue, periodTo: newDue }
          });
        }
      }
    });

    const updated = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { student: true, subject: true, teacher: true, group: true }
    });

    return {
      ...updated,
      paymentShift
    };
  }

  async unfreeze(user: AuthUser, id: string, _dto: UnfreezeEnrollmentDto) {
    await this.findOne(user, id);
    const rawEnrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      select: { frozenAt: true }
    });
    if (!rawEnrollment?.frozenAt) {
      throw new BadRequestException("Enrollment is not frozen");
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: {
        frozenAt: null,
        frozenUntil: null,
        freezeReason: null,
        status: "ACTIVE"
      },
      include: { student: true, subject: true, teacher: true, group: true }
    });
  }

  /**
   * Запланированный перерыв ученика по записи.
   * - Режим с датой: указывается дата возвращения, оплата ждётся с неё, по дате — авто-возврат.
   * - Бессрочный режим: дата не указана, снимается вручную через endBreak.
   * Во время перерыва запись исключается из долгов и дат оплаты, занятия убираются.
   */
  async startBreak(id: string, dto: StartBreakDto) {
    const enrollment = await this.findOne(id);
    const from = dto.from ? new Date(dto.from) : new Date();
    const until = dto.until ? new Date(dto.until) : null;
    if (until && until.getTime() <= from.getTime()) {
      throw new BadRequestException("Дата возвращения должна быть позже начала перерыва");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id },
        data: { breakStart: from, breakEnd: until, breakReason: dto.reason ?? null }
      });

      const windowFilter = { gte: from, ...(until ? { lt: until } : {}) };

      if (enrollment.type === EnrollmentType.INDIVIDUAL) {
        // Убираем запланированные индивидуальные занятия на время перерыва.
        await tx.lesson.deleteMany({
          where: { enrollmentId: id, status: "SCHEDULED", startsAt: windowFilter }
        });
      } else if (enrollment.type === EnrollmentType.GROUP && enrollment.groupId) {
        // Групповые занятия общие — убираем только будущие отметки ученика (если были созданы).
        await tx.attendance.deleteMany({
          where: {
            studentId: enrollment.studentId,
            lesson: { groupId: enrollment.groupId, status: "SCHEDULED", startsAt: windowFilter }
          }
        });
      }

      // Режим с датой: переносим дату следующей оплаты на дату возвращения.
      if (until) {
        const latestCharge = await tx.charge.findFirst({
          where: { enrollmentId: id },
          orderBy: { periodFrom: "desc" }
        });
        if (latestCharge) {
          await tx.charge.update({ where: { id: latestCharge.id }, data: { nextPaymentDue: until } });
        }
      }

      return tx.enrollment.findUnique({
        where: { id },
        include: { student: true, subject: true, teacher: true, group: true }
      });
    });
  }

  /** Завершить перерыв: запись снова активна, оплата ожидается с момента возвращения. */
  async endBreak(id: string) {
    const enrollment = await this.findOne(id);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id },
        data: { breakStart: null, breakEnd: null, breakReason: null }
      });

      // Снова ждём оплату — с момента возвращения.
      const latestCharge = await tx.charge.findFirst({
        where: { enrollmentId: id },
        orderBy: { periodFrom: "desc" }
      });
      if (latestCharge) {
        await tx.charge.update({ where: { id: latestCharge.id }, data: { nextPaymentDue: now } });
      }

      // Индивидуальные занятия пересоздаём на 4 недели вперёд.
      if (enrollment.type === EnrollmentType.INDIVIDUAL) {
        const to = new Date();
        to.setDate(to.getDate() + 28);
        let occurrences: LessonOccurrence[] = [];
        try {
          occurrences = getLessonOccurrences(enrollment.schedulePattern, now, 200).filter(
            (occ) => occ.startsAt <= to
          );
        } catch {
          occurrences = [];
        }
        for (const { startsAt, duration } of occurrences) {
          const exists = await tx.lesson.findFirst({
            where: {
              enrollmentId: id,
              startsAt: {
                gte: new Date(startsAt.getTime() - 60_000),
                lte: new Date(startsAt.getTime() + 60_000)
              }
            }
          });
          if (exists) continue;
          await tx.lesson.create({
            data: {
              type: "INDIVIDUAL",
              studentId: enrollment.studentId,
              enrollmentId: id,
              teacherId: enrollment.teacherId,
              subjectId: enrollment.subjectId,
              startsAt,
              endsAt: new Date(startsAt.getTime() + duration * 60_000)
            }
          });
        }
      }

      return tx.enrollment.findUnique({
        where: { id },
        include: { student: true, subject: true, teacher: true, group: true }
      });
    });
  }

  async addLessonDebt(id: string, dto: AddLessonDebtDto) {
    await this.findOne(id);
    return this.prisma.enrollment.update({
      where: { id },
      data: {
        lessonDebt: { increment: dto.lessons }
      },
      include: { student: true, subject: true, teacher: true, group: true }
    });
  }

  async transferToGroup(user: AuthUser, enrollmentId: string, targetGroupId: string) {
    const enrollment = await this.findOne(user, enrollmentId);
    if (enrollment.type !== EnrollmentType.GROUP) {
      throw new BadRequestException("Перевод возможен только для групповых записей");
    }
    if (user.role === RoleName.TEACHER && enrollment.teacherId !== user.teacherId) {
      throw new ForbiddenException("Можно переводить только своих учеников");
    }

    const targetGroup = await this.prisma.group.findFirst({
      where: {
        id: targetGroupId,
        status: "ACTIVE",
        ...(user.role === RoleName.TEACHER
          ? { teachers: { some: { teacherId: user.teacherId! } } }
          : {})
      },
      include: { teachers: true }
    });
    if (!targetGroup) {
      throw new BadRequestException("Группа не найдена или у вас нет к ней доступа");
    }
    if (enrollment.groupId === targetGroupId) {
      throw new BadRequestException("Ученик уже в этой группе");
    }

    const teacherId = targetGroup.teachers[0]?.teacherId ?? enrollment.teacherId;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (enrollment.groupId) {
        await tx.studentGroup.updateMany({
          where: { studentId: enrollment.studentId, groupId: enrollment.groupId, status: "ACTIVE" },
          data: { status: "LEFT", leftAt: now }
        });
        await tx.enrollment.updateMany({
          where: { id: enrollment.id, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", endDate: now }
        });
        await tx.attendance.deleteMany({
          where: {
            studentId: enrollment.studentId,
            lesson: { groupId: enrollment.groupId, startsAt: { gte: now }, status: "SCHEDULED" }
          }
        });
      }

      await tx.enrollment.create({
        data: {
          studentId: enrollment.studentId,
          subjectId: targetGroup.subjectId,
          teacherId,
          groupId: targetGroupId,
          type: "GROUP",
          price: enrollment.price,
          teacherCommission: enrollment.teacherCommission,
          paymentPeriod: enrollment.paymentPeriod,
          schedulePattern: targetGroup.schedulePattern ?? undefined
        }
      });

      await tx.studentGroup.upsert({
        where: { studentId_groupId: { studentId: enrollment.studentId, groupId: targetGroupId } },
        create: { studentId: enrollment.studentId, groupId: targetGroupId, price: enrollment.price },
        update: { status: "ACTIVE", leftAt: null, price: enrollment.price }
      });

      return tx.enrollment.findFirst({
        where: { studentId: enrollment.studentId, groupId: targetGroupId, status: "ACTIVE" },
        include: { student: true, subject: true, teacher: true, group: true },
        orderBy: { createdAt: "desc" }
      });
    });
  }

  /**
   * Финансы преподавателя: доля от фактических оплат учеников (commission%).
   * Начисляется сразу при каждом взносе, а не по количеству занятий.
   */
  async getTeacherEarnings(user: AuthUser, teacherId: string, fromDate?: string, toDate?: string) {
    if (user.role === RoleName.TEACHER && teacherId !== user.teacherId) {
      throw new ForbiddenException("Teachers can only view their own earnings");
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const periodFrom = fromDate ? new Date(fromDate) : monthStart;
    const periodTo = toDate ? new Date(toDate) : now;
    const startOfToday = getStartOfDayInAppTz(now);

    const share = (amount: number, commission: number) => Math.round((amount * commission) / 100);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { teacherId, status: { not: "CANCELLED" } },
      include: {
        student: true,
        subject: true,
        group: true,
        payments: { orderBy: { paidAt: "asc" } },
        charges: {
          orderBy: { periodFrom: "desc" },
          take: 1,
          include: { payments: { select: { amount: true } } }
        }
      }
    });

    const payouts = await this.prisma.teacherPayout.findMany({
      where: { teacherId },
      orderBy: { paidAt: "desc" }
    });

    let accruedAllTime = 0;
    let accruedInPeriod = 0;
    let expectedThisMonth = 0;

    type StudentRow = {
      enrollmentId: string;
      studentId: string;
      studentName: string;
      subjectName: string;
      type: string;
      groupName: string | null;
      commission: number;
      accruedInPeriod: number;
      accruedAllTime: number;
      expectedThisMonth: number;
      studentDebt: number;
      teacherDebtShare: number;
      nextPaymentDue: string | null;
      onBreak: boolean;
    };

    const byStudent: StudentRow[] = [];
    const upcomingPayments: Array<{
      studentName: string;
      subjectName: string;
      dueDate: string;
      amount: number;
      teacherShare: number;
    }> = [];
    const debtors: Array<{
      studentName: string;
      subjectName: string;
      debt: number;
      teacherShare: number;
      dueDate: string;
    }> = [];

    for (const enrollment of enrollments) {
      const commission = enrollment.teacherCommission || 0;
      let rowAccruedAll = 0;
      let rowAccruedPeriod = 0;

      for (const payment of enrollment.payments) {
        const portion = share(payment.amount, commission);
        rowAccruedAll += portion;
        accruedAllTime += portion;
        if (payment.paidAt >= periodFrom && payment.paidAt <= periodTo) {
          rowAccruedPeriod += portion;
          accruedInPeriod += portion;
        }
      }

      const onBreak = isEnrollmentOnBreak(enrollment, now);
      const charge = enrollment.charges[0];
      let studentDebt = 0;
      let teacherDebtShare = 0;
      let nextDue: Date | null = null;
      let rowExpected = 0;

      if (charge && !onBreak) {
        const paid = charge.payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = charge.dueAmount - paid;
        const cycleStarted = new Date(charge.periodFrom) < startOfToday;

        if (balance > 0 && (paid > 0 || cycleStarted)) {
          studentDebt = balance;
          teacherDebtShare = share(balance, commission);
        }

        nextDue =
          balance > 0
            ? charge.periodFrom
            : charge.nextPaymentDue ?? charge.periodTo;

        if (nextDue && nextDue >= monthStart && nextDue <= monthEnd) {
          const base = balance > 0 ? balance : enrollment.price;
          rowExpected = share(base, commission);
          expectedThisMonth += rowExpected;
        }

        if (nextDue && studentDebt === 0 && nextDue >= now && nextDue <= new Date(now.getTime() + 14 * 86400000)) {
          upcomingPayments.push({
            studentName: enrollment.student.fullName,
            subjectName: enrollment.subject.name,
            dueDate: nextDue.toISOString(),
            amount: enrollment.price,
            teacherShare: share(enrollment.price, commission)
          });
        }

        if (studentDebt > 0 && nextDue) {
          debtors.push({
            studentName: enrollment.student.fullName,
            subjectName: enrollment.subject.name,
            debt: studentDebt,
            teacherShare: teacherDebtShare,
            dueDate: nextDue.toISOString()
          });
        }
      }

      byStudent.push({
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        studentName: enrollment.student.fullName,
        subjectName: enrollment.subject.name,
        type: enrollment.type,
        groupName: enrollment.group?.name ?? null,
        commission,
        accruedInPeriod: rowAccruedPeriod,
        accruedAllTime: rowAccruedAll,
        expectedThisMonth: rowExpected,
        studentDebt,
        teacherDebtShare,
        nextPaymentDue: nextDue?.toISOString() ?? null,
        onBreak
      });
    }

    const paidOutAllTime = payouts.reduce((sum, p) => sum + p.amount, 0);
    const unpaidBalance = Math.max(0, accruedAllTime - paidOutAllTime);

    upcomingPayments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    debtors.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    byStudent.sort((a, b) => a.studentName.localeCompare(b.studentName, "ru"));

    return {
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      accruedInPeriod,
      accruedAllTime,
      paidOutAllTime,
      unpaidBalance,
      expectedThisMonth,
      byStudent,
      upcomingPayments,
      debtors,
      recentPayouts: payouts.slice(0, 10).map((p) => ({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt.toISOString(),
        comment: p.comment
      }))
    };
  }
}
