import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ChargeStatus, PaymentPeriod, Prisma, RoleName } from "@prisma/client";
import { AuthUser } from "../common/decorators/current-user.decorator";
import {
  buildLessonPaymentCycle,
  buildMonthlyPaymentCycle,
  resolveEnrollmentSchedulePattern
} from "../common/utils/lesson-schedule";
import { recomputeChargeStatus } from "../common/utils/charge-sync";
import { PrismaService } from "../prisma/prisma.service";
import { AddInstallmentDto, CreateChargeDto, UpdateChargeDto } from "./charges.dto";

const chargeInclude = {
  student: true,
  enrollment: { include: { subject: true, teacher: true, group: true } },
  payments: { orderBy: { paidAt: "asc" as const } }
} satisfies Prisma.ChargeInclude;

@Injectable()
export class ChargesService {
  constructor(private readonly prisma: PrismaService) {}

  private visibleWhere(user: AuthUser): Prisma.ChargeWhereInput {
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

  private decorate<T extends { dueAmount: number; payments: { amount: number }[] }>(charge: T) {
    const paidAmount = charge.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return { ...charge, paidAmount, balance: charge.dueAmount - paidAmount };
  }

  async findAll(user: AuthUser) {
    const charges = await this.prisma.charge.findMany({
      where: this.visibleWhere(user),
      include: chargeInclude,
      orderBy: { createdAt: "desc" }
    });
    return charges.map((charge) => this.decorate(charge));
  }

  private async getOne(id: string) {
    const charge = await this.prisma.charge.findUnique({ where: { id }, include: chargeInclude });
    if (!charge) throw new NotFoundException("Charge not found");
    return this.decorate(charge);
  }

  async create(userId: string, dto: CreateChargeDto) {
    const paidAt = new Date(dto.paidAt);
    let periodFrom: Date;
    let periodTo: Date;
    let lessonsInCycle: number | null = null;
    let nextPaymentDue: Date | null = null;

    if (dto.enrollmentId) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { id: dto.enrollmentId },
        include: { group: { select: { schedulePattern: true } } }
      });
      if (!enrollment) throw new NotFoundException("Enrollment not found");
      if (enrollment.studentId !== dto.studentId) {
        throw new BadRequestException("Запись принадлежит другому студенту");
      }
      const cycle = this.resolveCycle(enrollment, paidAt, dto.lessonsInCycle, dto.paymentPeriod);
      periodFrom = cycle.periodFrom;
      periodTo = cycle.periodTo;
      lessonsInCycle = cycle.lessonsInCycle || null;
      nextPaymentDue = cycle.nextPaymentDue;
    } else {
      if (!dto.periodFrom || !dto.periodTo) {
        throw new BadRequestException("Укажите запись или период вручную");
      }
      periodFrom = new Date(dto.periodFrom);
      periodTo = new Date(dto.periodTo);
    }

    const charge = await this.prisma.charge.create({
      data: {
        studentId: dto.studentId,
        enrollmentId: dto.enrollmentId,
        dueAmount: dto.dueAmount,
        periodFrom,
        periodTo,
        lessonsInCycle,
        nextPaymentDue,
        comment: dto.comment,
        createdById: userId,
        status: ChargeStatus.UNPAID
      }
    });

    if (dto.firstAmount && dto.firstAmount > 0) {
      await this.prisma.payment.create({
        data: {
          studentId: dto.studentId,
          enrollmentId: dto.enrollmentId,
          chargeId: charge.id,
          amount: dto.firstAmount,
          method: dto.method ?? "CASH",
          paidAt,
          periodFrom,
          periodTo,
          lessonsInCycle,
          nextPaymentDue,
          recordedById: userId
        }
      });
    }

    await this.recompute(charge.id);
    return this.getOne(charge.id);
  }

  async addInstallment(userId: string, chargeId: string, dto: AddInstallmentDto) {
    const charge = await this.prisma.charge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException("Charge not found");

    await this.prisma.payment.create({
      data: {
        studentId: charge.studentId,
        enrollmentId: charge.enrollmentId,
        chargeId: charge.id,
        amount: dto.amount,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        periodFrom: charge.periodFrom,
        periodTo: charge.periodTo,
        lessonsInCycle: charge.lessonsInCycle,
        nextPaymentDue: charge.nextPaymentDue,
        comment: dto.comment,
        recordedById: userId
      }
    });

    await this.recompute(chargeId);
    return this.getOne(chargeId);
  }

  async update(id: string, dto: UpdateChargeDto) {
    const charge = await this.prisma.charge.findUnique({ where: { id } });
    if (!charge) throw new NotFoundException("Charge not found");

    await this.prisma.charge.update({
      where: { id },
      data: {
        ...(dto.dueAmount !== undefined && { dueAmount: dto.dueAmount }),
        ...(dto.comment !== undefined && { comment: dto.comment })
      }
    });

    await this.recompute(id);
    return this.getOne(id);
  }

  async remove(id: string) {
    const charge = await this.prisma.charge.findUnique({ where: { id } });
    if (!charge) throw new NotFoundException("Charge not found");
    await this.prisma.charge.delete({ where: { id } });
    return { ok: true };
  }

  async removeInstallment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException("Payment not found");
    await this.prisma.payment.delete({ where: { id: paymentId } });
    if (payment.chargeId) await this.recompute(payment.chargeId);
    return { ok: true };
  }

  private async recompute(chargeId: string) {
    await recomputeChargeStatus(this.prisma, chargeId);
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
}
