import { PrismaClient, RoleName } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

/**
 * Полная очистка операционных данных учебного центра.
 * Сохраняются только роли и учётная запись администратора, чтобы можно было войти.
 * Запуск: pnpm --filter @study-crm/api prisma:reset  (или pnpm db:reset из корня)
 */
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? "admin@study.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  // Удаляем данные в порядке, безопасном для внешних ключей.
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.teacherPayout.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.groupTeacher.deleteMany();
  await prisma.studentNote.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.group.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();

  // Гарантируем наличие ролей.
  const roles = await Promise.all(
    Object.values(RoleName).map((name) => prisma.role.upsert({ where: { name }, create: { name }, update: {} }))
  );
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  // Удаляем всех пользователей, кроме администратора (и их refresh-токены).
  await prisma.refreshToken.deleteMany({ where: { user: { email: { not: adminEmail } } } });
  await prisma.user.deleteMany({ where: { email: { not: adminEmail } } });

  // Гарантируем наличие администратора.
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: "Super Admin",
      passwordHash: await argon2.hash(adminPassword),
      roleId: roleByName.get(RoleName.ADMIN)!.id
    },
    update: {}
  });

  console.log(`База очищена. Вход администратора сохранён: ${adminEmail}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
