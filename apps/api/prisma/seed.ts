import { PrismaClient, RoleName } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        create: { name },
        update: {}
      })
    )
  );
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? "admin@study.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const teacherPassword = process.env.DEMO_TEACHER_PASSWORD ?? "TeacherDemo123!";
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD ?? "StudentDemo123!";

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: "Super Admin",
      passwordHash: await argon2.hash(adminPassword),
      roleId: roleByName.get(RoleName.ADMIN)!.id
    },
    update: {
      passwordHash: await argon2.hash(adminPassword)
    }
  });

  const english = await prisma.subject.upsert({
    where: { name: "English" },
    create: { name: "English", description: "General English course" },
    update: {}
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@study.local" },
    create: {
      email: "teacher@study.local",
      fullName: "Jane Teacher",
      passwordHash: await argon2.hash(teacherPassword),
      roleId: roleByName.get(RoleName.TEACHER)!.id
    },
    update: {
      passwordHash: await argon2.hash(teacherPassword)
    }
  });

  const teacher = await prisma.teacher.upsert({
    where: { email: "teacher@study.local" },
    create: {
      fullName: "Jane Teacher",
      email: "teacher@study.local",
      phone: "+998901112233",
      specialization: "English",
      userId: teacherUser.id
    },
    update: {
      userId: teacherUser.id
    }
  });

  const demoSchedule = { daysOfWeek: [1, 3, 5], time: "10:00", duration: 90 };

  const group = await prisma.group.create({
    data: {
      name: "English A1 Morning",
      subjectId: english.id,
      monthlyPrice: 500000,
      startDate: new Date(),
      schedulePattern: demoSchedule
    }
  });

  await prisma.groupTeacher.create({ data: { groupId: group.id, teacherId: teacher.id } });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@study.local" },
    create: {
      email: "student@study.local",
      fullName: "Demo Student",
      passwordHash: await argon2.hash(studentPassword),
      roleId: roleByName.get(RoleName.STUDENT)!.id
    },
    update: {
      passwordHash: await argon2.hash(studentPassword)
    }
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    create: {
      fullName: "Demo Student",
      phone: "+998909998877",
      parentPhone: "+998901234567",
      source: "Referral",
      userId: studentUser.id
    },
    update: {
      userId: studentUser.id
    }
  });

  await prisma.studentGroup.upsert({
    where: { studentId_groupId: { studentId: student.id, groupId: group.id } },
    create: { studentId: student.id, groupId: group.id },
    update: {}
  });

  // Check if enrollment already exists before creating
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, subjectId: english.id }
  });
  if (!existingEnrollment) {
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        subjectId: english.id,
        teacherId: teacher.id,
        groupId: group.id,
        type: "GROUP",
        price: 500000,
        paymentPeriod: "PER_LESSON",
        totalLessons: 12,
        schedulePattern: demoSchedule
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
