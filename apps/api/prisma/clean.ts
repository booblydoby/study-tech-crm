import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");

  // Delete in reverse dependency order
  await prisma.notification.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.studentNote.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.groupTeacher.deleteMany();
  await prisma.group.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.refreshToken.deleteMany();

  // Delete users except admin
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@study.local";
  await prisma.user.deleteMany({ where: { NOT: { email: adminEmail } } });

  console.log("Database cleaned. Only admin user and roles remain.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });