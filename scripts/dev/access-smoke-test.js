const { PrismaClient } = require("../../apps/api/node_modules/@prisma/client");

const API = "http://localhost:4000/api/v1";
const prisma = new PrismaClient();

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok && !options.allowError) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return { status: response.status, data };
}

async function login(email, password) {
  const { data } = await api("/auth/login", { method: "POST", body: { email, password } });
  return data.accessToken;
}

function assertStatus(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`ok ${label}: ${actual}`);
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "smoke-" } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);
  await prisma.attendance.deleteMany({});
  await prisma.payment.deleteMany({ where: { student: { fullName: { startsWith: "Smoke " } } } });
  await prisma.lesson.deleteMany({ where: { subject: { name: { startsWith: "Smoke " } } } });
  await prisma.enrollment.deleteMany({ where: { subject: { name: { startsWith: "Smoke " } } } });
  await prisma.studentGroup.deleteMany({ where: { student: { fullName: { startsWith: "Smoke " } } } });
  await prisma.groupTeacher.deleteMany({ where: { group: { name: { startsWith: "Smoke " } } } });
  await prisma.group.deleteMany({ where: { name: { startsWith: "Smoke " } } });
  await prisma.student.deleteMany({ where: { fullName: { startsWith: "Smoke " } } });
  await prisma.teacher.deleteMany({ where: { fullName: { startsWith: "Smoke " } } });
  await prisma.subject.deleteMany({ where: { name: { startsWith: "Smoke " } } });
  if (userIds.length) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  await cleanup();

  const admin = await login("admin@study.local", "ChangeMe123!");
  const teacherUser1 = (
    await api("/users", {
      method: "POST",
      token: admin,
      body: {
        email: "smoke-teacher1@study.local",
        password: "Teacher123!",
        fullName: "Smoke Teacher One",
        role: "TEACHER"
      }
    })
  ).data;
  const teacherUser2 = (
    await api("/users", {
      method: "POST",
      token: admin,
      body: {
        email: "smoke-teacher2@study.local",
        password: "Teacher123!",
        fullName: "Smoke Teacher Two",
        role: "TEACHER"
      }
    })
  ).data;
  const teacher1 = (
    await api("/teachers", {
      method: "POST",
      token: admin,
      body: { fullName: "Smoke Teacher One", email: "smoke-teacher1@study.local", userId: teacherUser1.id }
    })
  ).data;
  const teacher2 = (
    await api("/teachers", {
      method: "POST",
      token: admin,
      body: { fullName: "Smoke Teacher Two", email: "smoke-teacher2@study.local", userId: teacherUser2.id }
    })
  ).data;
  const subject = (
    await api("/subjects", {
      method: "POST",
      token: admin,
      body: { name: "Smoke English" }
    })
  ).data;
  const group = (
    await api("/groups", {
      method: "POST",
      token: admin,
      body: { name: "Smoke Group", subjectId: subject.id, monthlyPrice: 500000 }
    })
  ).data;
  await api(`/groups/${group.id}/teachers`, { method: "POST", token: admin, body: { teacherId: teacher1.id } });

  const student1 = (
    await api("/students", {
      method: "POST",
      token: admin,
      body: { fullName: "Smoke Student One", login: "smoke-student1", password: "Student123!" }
    })
  ).data;
  const student2 = (
    await api("/students", {
      method: "POST",
      token: admin,
      body: { fullName: "Smoke Student Two", login: "smoke-student2", password: "Student123!" }
    })
  ).data;
  const enrollment = (
    await api("/enrollments", {
      method: "POST",
      token: admin,
      body: {
        studentId: student1.id,
        subjectId: subject.id,
        teacherId: teacher1.id,
        groupId: group.id,
        type: "GROUP",
        price: 500000,
        teacherCommission: 30,
        totalLessons: 12
      }
    })
  ).data;
  const lesson = (
    await api("/lessons", {
      method: "POST",
      token: admin,
      body: {
        type: "GROUP",
        enrollmentId: enrollment.id,
        groupId: group.id,
        teacherId: teacher1.id,
        subjectId: subject.id,
        startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      }
    })
  ).data;
  const payment = (
    await api("/payments", {
      method: "POST",
      token: admin,
      body: {
        studentId: student1.id,
        enrollmentId: enrollment.id,
        amount: 500000,
        method: "CASH",
        paidAt: new Date().toISOString(),
        periodFrom: new Date().toISOString(),
        periodTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    })
  ).data;

  const teacherToken1 = await login("smoke-teacher1@study.local", "Teacher123!");
  const teacherToken2 = await login("smoke-teacher2@study.local", "Teacher123!");
  const studentToken1 = await login("smoke-student1", "Student123!");
  const studentToken2 = await login("smoke-student2", "Student123!");

  assertStatus(
    "teacher can read own lesson",
    (await api(`/lessons/${lesson.id}`, { token: teacherToken1, allowError: true })).status,
    200
  );
  assertStatus(
    "other teacher cannot read lesson",
    (await api(`/lessons/${lesson.id}`, { token: teacherToken2, allowError: true })).status,
    404
  );
  assertStatus(
    "student in group can read lesson",
    (await api(`/lessons/${lesson.id}`, { token: studentToken1, allowError: true })).status,
    200
  );
  assertStatus(
    "other student cannot read lesson",
    (await api(`/lessons/${lesson.id}`, { token: studentToken2, allowError: true })).status,
    404
  );
  assertStatus(
    "teacher cannot read other teacher earnings",
    (await api(`/enrollments/teacher/${teacher1.id}/earnings`, { token: teacherToken2, allowError: true })).status,
    403
  );
  assertStatus(
    "student cannot read other payment",
    (await api(`/payments/${payment.id}`, { token: studentToken2, allowError: true })).status,
    404
  );
  assertStatus(
    "student cannot open admin analytics",
    (await api("/analytics/dashboard", { token: studentToken1, allowError: true })).status,
    403
  );

  await cleanup();
}

main()
  .then(() => console.log("access smoke test passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
