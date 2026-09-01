import { Injectable } from "@nestjs/common";
import { EnrollmentStatus, Prisma } from "@prisma/client";
import { AttendanceService } from "../attendance/attendance.service";
import { getAppTimezone, getStartOfDayInAppTz, isEnrollmentOnBreak } from "../common/utils/lesson-schedule";
import { ExpensesService } from "../expenses/expenses.service";
import { PrismaService } from "../prisma/prisma.service";

type MoneyDebtor = {
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
  charges: number;
};

type PaymentDueItem = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentPhone: string | null;
  subjectName: string;
  teacherName: string;
  groupName: string | null;
  enrollmentStatus: EnrollmentStatus;
  paymentPeriod: string;
  amount: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  lastPaidAt: string | null;
  hasPayment: boolean;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly attendanceService: AttendanceService
  ) {}

  private toDateKey(date: Date, timeZone = getAppTimezone()): string {
    return date.toLocaleDateString("en-CA", { timeZone });
  }

  private diffCalendarDays(fromKey: string, toKey: string): number {
    const from = new Date(`${fromKey}T12:00:00Z`);
    const to = new Date(`${toKey}T12:00:00Z`);
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }
  async dashboard() {
    const [students, activeGroups, teachers, revenue, expectedRevenue, debts, moneyDebt, attendance] =
      await Promise.all([
        this.prisma.student.count({ where: { status: "ACTIVE" } }),
        this.prisma.group.count({ where: { status: "ACTIVE" } }),
        this.prisma.teacher.count({ where: { isActive: true } }),
        this.revenue(),
        this.expectedRevenue(),
        this.debts(),
        this.moneyDebt(),
        this.attendance()
      ]);
    return {
      students,
      activeGroups,
      teachers,
      revenue: revenue.total,
      expectedRevenue: expectedRevenue.total,
      debts: debts.count,
      moneyDebtTotal: moneyDebt.totalDebt,
      moneyDebtorsCount: moneyDebt.debtors.length,
      attendance
    };
  }

  /** Денежный долг: сумма недоплат по начислениям (учитываются только billable записи). */
  async moneyDebt() {
    const charges = await this.prisma.charge.findMany({
      where: {
        OR: [{ enrollmentId: null }, { enrollment: { billable: true } }]
      },
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
        enrollment: { select: { breakStart: true, breakEnd: true } },
        payments: { select: { amount: true } }
      }
    });

    const byStudent = new Map<string, MoneyDebtor>();
    let totalDebt = 0;

    const now = new Date();
    const startOfToday = getStartOfDayInAppTz(now);

    for (const charge of charges) {
      // Запись на перерыве — не показываем как долг (ложный долг во время паузы).
      if (charge.enrollment && isEnrollmentOnBreak(charge.enrollment, now)) continue;
      const paid = charge.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = charge.dueAmount - paid;
      if (balance <= 0) continue;
      // Полностью неоплаченное начисление не считается долгом, пока цикл не начался.
      const cycleStarted = new Date(charge.periodFrom) < startOfToday;
      if (paid === 0 && !cycleStarted) continue;
      totalDebt += balance;

      const existing = byStudent.get(charge.studentId);
      if (existing) {
        existing.totalDue += charge.dueAmount;
        existing.totalPaid += paid;
        existing.balance += balance;
        existing.charges += 1;
      } else {
        byStudent.set(charge.studentId, {
          studentId: charge.student.id,
          studentName: charge.student.fullName,
          studentPhone: charge.student.phone,
          totalDue: charge.dueAmount,
          totalPaid: paid,
          balance,
          charges: 1
        });
      }
    }

    const debtors = Array.from(byStudent.values()).sort((a, b) => b.balance - a.balance);
    return { totalDebt, debtors };
  }
  async revenue() {
    const result = await this.prisma.payment.aggregate({ _sum: { amount: true } });
    return { total: result._sum.amount ?? 0 };
  }
  async expectedRevenue() {
    const result = await this.prisma.enrollment.aggregate({
      where: { status: "ACTIVE", billable: true },
      _sum: { price: true }
    });
    return { total: result._sum.price ?? 0 };
  }
  async debts() {
    const status = await this.paymentDueStatus();
    return { count: status.overdueCount };
  }
  async attendance() {
    await this.attendanceService.backfillCompletedLessonsWithoutAttendance();
    const rows = await this.prisma.attendance.groupBy({ by: ["status"], _count: true });
    return rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: row._count }), {});
  }

  /**
   * Приводит данные в порядок: отменяет «зависшие» групповые записи, у которых
   * студент уже не состоит активно в группе (после удаления/перевода), а также
   * групповые записи без группы. Это убирает рассинхрон в аналитике.
   */
  async reconcile() {
    const groupEnrollments = await this.prisma.enrollment.findMany({
      where: {
        type: "GROUP",
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PAUSED] }
      },
      select: { id: true, studentId: true, groupId: true }
    });

    const toCancel: string[] = [];
    for (const enrollment of groupEnrollments) {
      if (!enrollment.groupId) {
        toCancel.push(enrollment.id);
        continue;
      }
      const membership = await this.prisma.studentGroup.findUnique({
        where: {
          studentId_groupId: { studentId: enrollment.studentId, groupId: enrollment.groupId }
        },
        select: { status: true }
      });
      if (!membership || membership.status !== "ACTIVE") {
        toCancel.push(enrollment.id);
      }
    }

    if (toCancel.length > 0) {
      await this.prisma.enrollment.updateMany({
        where: { id: { in: toCancel } },
        data: { status: "CANCELLED", endDate: new Date() }
      });
    }

    return { cancelledEnrollments: toCancel.length };
  }

  async paymentDueStatus(daysAhead = 14) {
    const timeZone = getAppTimezone();
    const todayKey = this.toDateKey(new Date(), timeZone);
    const upcomingUntilKey = this.toDateKey(
      new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
      timeZone
    );

    const enrollments = await this.prisma.enrollment.findMany({
      where: { status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PAUSED] }, billable: true },
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
        group: { select: { name: true } },
        charges: {
          orderBy: { periodFrom: "desc" },
          take: 1,
          include: { payments: { select: { amount: true } } }
        }
      },
      orderBy: { student: { fullName: "asc" } }
    });

    const now = new Date();
    const items: PaymentDueItem[] = [];
    for (const enrollment of enrollments) {
      // Запись на перерыве — оплату не ждём, в список не показываем.
      if (isEnrollmentOnBreak(enrollment, now)) continue;
      // Нет ни одного начисления — платить пока нечего, в список не показываем.
      const charge = enrollment.charges[0];
      if (!charge) continue;

      const paid = charge.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = charge.dueAmount - paid;

      // Если текущий цикл недоплачен — платёж ожидается с начала цикла.
      // Если оплачен полностью — следующий платёж в конце цикла.
      const dueDate = balance > 0 ? charge.periodFrom : charge.nextPaymentDue ?? charge.periodTo;
      const dueKey = this.toDateKey(dueDate, timeZone);
      const diff = this.diffCalendarDays(todayKey, dueKey);
      const daysUntilDue = diff >= 0 ? diff : null;
      const daysOverdue = diff < 0 ? -diff : null;

      items.push({
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        studentName: enrollment.student.fullName,
        studentPhone: enrollment.student.phone,
        subjectName: enrollment.subject.name,
        teacherName: enrollment.teacher.fullName,
        groupName: enrollment.group?.name ?? null,
        enrollmentStatus: enrollment.status,
        paymentPeriod: enrollment.paymentPeriod,
        amount: balance > 0 ? balance : enrollment.price,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        daysOverdue,
        lastPaidAt: null,
        hasPayment: paid > 0
      });
    }

    const overdue = items
      .filter((item) => this.toDateKey(new Date(item.dueDate!), timeZone) < todayKey)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const upcoming = items
      .filter((item) => {
        if (!item.dueDate) return false;
        const dueKey = this.toDateKey(new Date(item.dueDate), timeZone);
        return dueKey >= todayKey && dueKey <= upcomingUntilKey;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    return {
      daysAhead,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      overdue,
      upcoming
    };
  }

  /** Выручка минус расходы и выплаты преподавателям = чистая прибыль. */
  async profitSummary(from?: string, to?: string) {
    const paidAt: Prisma.DateTimeFilter | undefined =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {})
          }
        : undefined;

    const [revenueAgg, payoutsAgg, expenseTotals] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paidAt ? { paidAt } : undefined,
        _sum: { amount: true }
      }),
      this.prisma.teacherPayout.aggregate({
        where: paidAt ? { paidAt } : undefined,
        _sum: { amount: true }
      }),
      this.expenses.totalByCategory(from, to)
    ]);

    const revenue = revenueAgg._sum.amount ?? 0;
    const teacherPayouts = payoutsAgg._sum.amount ?? 0;
    const expensesTotal = expenseTotals.total;
    const netProfit = revenue - expensesTotal - teacherPayouts;

    return {
      revenue,
      expensesTotal,
      teacherPayouts,
      netProfit,
      expensesByCategory: expenseTotals.byCategory,
      periodFrom: from ?? null,
      periodTo: to ?? null
    };
  }
}
