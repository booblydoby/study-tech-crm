import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentPeriod, Prisma, RoleName } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import {
  buildLessonPaymentCycle,
  buildMonthlyPaymentCycle,
  resolveEnrollmentSchedulePattern
} from "../common/utils/lesson-schedule";
import { publicUserSelect } from "../common/prisma/user.select";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto, PaymentCyclePreviewDto, UpdatePaymentDto } from "./payments.dto";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUser) {
    return this.prisma.payment.findMany({
      where: this.visiblePaymentWhere(user),
      include: {
        student: true,
        enrollment: { include: { subject: true, teacher: true, group: true } },
        recordedBy: { select: publicUserSelect }
      },
      orderBy: { paidAt: "desc" }
    });
  }

  async findOne(userOrId: AuthUser | string, maybeId?: string) {
    const user = typeof userOrId === "string" ? undefined : userOrId;
    const id = typeof userOrId === "string" ? userOrId : maybeId!;
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...(user ? this.visiblePaymentWhere(user) : {}) },
      include: { student: true, enrollment: { include: { subject: true, teacher: true, group: true } } }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  async previewCycle(dto: PaymentCyclePreviewDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        student: true,
        subject: true,
        group: { select: { schedulePattern: true } }
      }
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");

    const paidAt = new Date(dto.paidAt);
    const cycle = this.resolveCycle(enrollment, paidAt, dto.lessonsInCycle, dto.paymentPeriod);

    return {
      enrollmentId: enrollment.id,
      studentName: enrollment.student.fullName,
      subjectName: enrollment.subject.name,
      paymentPeriod: dto.paymentPeriod ?? enrollment.paymentPeriod,
      lessonsInCycle: cycle.lessonsInCycle,
      paidAt: paidAt.toISOString(),
      periodFrom: cycle.periodFrom.toISOString(),
      periodTo: cycle.periodTo.toISOString(),
      nextPaymentDue: cycle.nextPaymentDue.toISOString(),
      lessonDates: cycle.lessonDates.map((date) => date.toISOString())
    };
  }

  async create(recordedById: string, dto: CreatePaymentDto) {
    const paidAt = new Date(dto.paidAt);
    let periodFrom: Date;
    let periodTo: Date;
    let lessonsInCycle: number | undefined;
    let nextPaymentDue: Date | undefined;

    if (dto.enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { id: dto.enrollmentId },
        include: { group: { select: { schedulePattern: true } } }
      });
      if (!enrollment) throw new NotFoundException("Enrollment not found");
      if (enrollment.studentId !== dto.studentId) {
        throw new BadRequestException("Enrollment does not belong to this student");
      }

      const cycle = this.resolveCycle(enrollment, paidAt, dto.lessonsInCycle, dto.paymentPeriod);
      periodFrom = cycle.periodFrom;
      periodTo = cycle.periodTo;
      lessonsInCycle = cycle.lessonsInCycle || undefined;
      nextPaymentDue = cycle.nextPaymentDue;
    } else {
      if (!dto.periodFrom || !dto.periodTo) {
        throw new BadRequestException("Укажите запись (enrollment) или даты периода вручную");
      }
      periodFrom = new Date(dto.periodFrom);
      periodTo = new Date(dto.periodTo);
    }

    return this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        enrollmentId: dto.enrollmentId,
        amount: dto.amount,
        method: dto.method,
        paidAt,
        periodFrom,
        periodTo,
        lessonsInCycle,
        nextPaymentDue,
        comment: dto.comment,
        recordedById
      },
      include: {
        student: true,
        enrollment: { include: { subject: true, teacher: true, group: true } }
      }
    });
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const existing = await this.findOne(id);
    const enrollmentId = dto.enrollmentId ?? existing.enrollmentId;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : existing.paidAt;

    let periodFrom = dto.periodFrom ? new Date(dto.periodFrom) : existing.periodFrom;
    let periodTo = dto.periodTo ? new Date(dto.periodTo) : existing.periodTo;
    let lessonsInCycle = dto.lessonsInCycle ?? existing.lessonsInCycle;
    let nextPaymentDue = dto.nextPaymentDue ? new Date(dto.nextPaymentDue) : existing.nextPaymentDue;

    const existingPeriod = existing.enrollment?.paymentPeriod;
    const paidAtChanged = dto.paidAt !== undefined && this.isDifferentCalendarDay(paidAt, existing.paidAt);
    const lessonsChanged = dto.lessonsInCycle !== undefined && dto.lessonsInCycle !== existing.lessonsInCycle;
    const enrollmentChanged = dto.enrollmentId !== undefined && dto.enrollmentId !== existing.enrollmentId;
    const periodChanged = dto.paymentPeriod !== undefined && dto.paymentPeriod !== existingPeriod;

    const shouldRecalculate = Boolean(
      enrollmentId && (paidAtChanged || lessonsChanged || enrollmentChanged || periodChanged)
    );

    if (shouldRecalculate && enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { group: { select: { schedulePattern: true } } }
      });
      if (!enrollment) throw new NotFoundException("Enrollment not found");

      const cycle = this.resolveCycle(
        enrollment,
        paidAt,
        dto.lessonsInCycle ?? lessonsInCycle ?? undefined,
        dto.paymentPeriod
      );
      periodFrom = cycle.periodFrom;
      periodTo = cycle.periodTo;
      lessonsInCycle = cycle.lessonsInCycle || null;
      nextPaymentDue = cycle.nextPaymentDue;
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.enrollmentId !== undefined && { enrollmentId: dto.enrollmentId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.method !== undefined && { method: dto.method }),
        ...(dto.paidAt !== undefined && { paidAt: new Date(dto.paidAt) }),
        ...(shouldRecalculate && { periodFrom, periodTo, lessonsInCycle, nextPaymentDue }),
        ...(dto.comment !== undefined && { comment: dto.comment })
      },
      include: {
        student: true,
        enrollment: { include: { subject: true, teacher: true, group: true } }
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.payment.delete({ where: { id } });
  }

  debts(user: AuthUser) {
    const now = new Date();
    return this.prisma.enrollment.findMany({
      where: {
        status: "ACTIVE",
        teacherId: user.role === RoleName.TEACHER ? user.teacherId : undefined,
        studentId: user.role === RoleName.STUDENT ? user.studentId : undefined,
        AND: [
          {
            OR: [
              { payments: { none: {} } },
              {
                payments: {
                  none: {
                    OR: [{ nextPaymentDue: { gte: now } }, { periodTo: { gte: now } }]
                  }
                }
              }
            ]
          }
        ]
      },
      include: {
        student: true,
        subject: true,
        teacher: true,
        group: true,
        payments: { orderBy: { paidAt: "desc" }, take: 1 }
      }
    });
  }

  upcoming(user: AuthUser, days = 7) {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + days);

    return this.prisma.payment.findMany({
      where: {
        ...this.visiblePaymentWhere(user),
        OR: [{ nextPaymentDue: { gte: now, lte: until } }, { nextPaymentDue: null, periodTo: { gte: now, lte: until } }]
      },
      include: { student: true, enrollment: { include: { subject: true, teacher: true, group: true } } },
      orderBy: [{ nextPaymentDue: "asc" }, { periodTo: "asc" }]
    });
  }

  private isDifferentCalendarDay(a: Date, b: Date): boolean {
    return a.toISOString().slice(0, 10) !== b.toISOString().slice(0, 10);
  }

  private resolveCycle(
    enrollment: {
      type: string;
      paymentPeriod: PaymentPeriod;
      totalLessons: number | null;
      schedulePattern: unknown;
      group: { schedulePattern: unknown } | null;
    },
    paidAt: Date,
    lessonsInCycle?: number,
    paymentPeriodOverride?: PaymentPeriod
  ) {
    const period = paymentPeriodOverride ?? enrollment.paymentPeriod;
    if (period === PaymentPeriod.MONTHLY) {
      const monthly = buildMonthlyPaymentCycle(paidAt);
      return { ...monthly, lessonsInCycle: 0 };
    }

    const lessons = lessonsInCycle ?? enrollment.totalLessons;
    if (!lessons || lessons < 1) {
      throw new BadRequestException("Укажите количество занятий в цикле оплаты");
    }

    const schedulePattern = resolveEnrollmentSchedulePattern(enrollment);
    if (!schedulePattern) {
      throw new BadRequestException("У записи нет расписания занятий");
    }

    try {
      return buildLessonPaymentCycle(schedulePattern, paidAt, lessons);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось построить цикл оплаты";
      throw new BadRequestException(message);
    }
  }

  private visiblePaymentWhere(user: AuthUser): Prisma.PaymentWhereInput {
    if (user.role === RoleName.TEACHER) {
      if (!user.teacherId) throw new ForbiddenException("Teacher profile is required");
      return { enrollment: { teacherId: user.teacherId } };
    }
    if (user.role === RoleName.STUDENT) {
      if (!user.studentId) throw new ForbiddenException("Student profile is required");
      return { studentId: user.studentId };
    }
    return {};
  }
}
