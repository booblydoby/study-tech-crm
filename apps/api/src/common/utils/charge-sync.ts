import { ChargeStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export async function recomputeChargeStatus(prisma: PrismaService, chargeId: string) {
  const charge = await prisma.charge.findUnique({
    where: { id: chargeId },
    include: { payments: { select: { amount: true } } }
  });
  if (!charge) return;

  const paid = charge.payments.reduce((sum, payment) => sum + payment.amount, 0);
  let status: ChargeStatus = ChargeStatus.UNPAID;
  if (paid <= 0) status = ChargeStatus.UNPAID;
  else if (paid < charge.dueAmount) status = ChargeStatus.PARTIAL;
  else status = ChargeStatus.PAID;

  await prisma.charge.update({ where: { id: chargeId }, data: { status } });
}

/** Пересчитывает сумму и статус незакрытых начислений после смены тарифа записи. */
export async function syncOpenChargesForEnrollment(
  prisma: PrismaService,
  enrollmentId: string,
  dueAmount: number
) {
  const charges = await prisma.charge.findMany({
    where: {
      enrollmentId,
      status: { in: [ChargeStatus.UNPAID, ChargeStatus.PARTIAL] }
    },
    select: { id: true }
  });

  for (const charge of charges) {
    await prisma.charge.update({
      where: { id: charge.id },
      data: { dueAmount }
    });
    await recomputeChargeStatus(prisma, charge.id);
  }

  return charges.length;
}
