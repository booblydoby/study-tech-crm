// Create user accounts for existing teachers that have email but no userId
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function main() {
  console.log("Migrating existing teachers to have user accounts...");

  const teachers = await prisma.teacher.findMany({
    where: {
      email: { not: null },
      userId: null
    }
  });

  console.log(`Found ${teachers.length} teachers without user accounts`);

  const teacherRole = await prisma.role.findUnique({ where: { name: "TEACHER" } });

  for (const teacher of teachers) {
    const email = teacher.email.toLowerCase().trim();
    
    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Link existing user to teacher
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { userId: existingUser.id }
      });
      console.log(`  ✓ Linked existing user ${email} → ${teacher.fullName}`);
      continue;
    }

    // Create new user with password "123"
    const hashedPassword = await argon2.hash("123");
    const user = await prisma.user.create({
      data: {
        email,
        fullName: teacher.fullName,
        passwordHash: hashedPassword,
        roleId: teacherRole.id
      }
    });

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { userId: user.id }
    });

    console.log(`  ✓ Created user ${email} (password: 123) → ${teacher.fullName}`);
  }

  // Also create for teachers with no email but we can use phone or generate
  const noEmailTeachers = await prisma.teacher.findMany({
    where: {
      email: null,
      userId: null
    }
  });

  for (const teacher of noEmailTeachers) {
    // Generate email from name
    const namePart = teacher.fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
    const email = `${namePart}@study.local`;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) continue;

    const hashedPassword = await argon2.hash("123");
    const user = await prisma.user.create({
      data: {
        email,
        fullName: teacher.fullName,
        passwordHash: hashedPassword,
        roleId: teacherRole.id
      }
    });

    // Update teacher email and userId
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { email, userId: user.id }
    });

    console.log(`  ✓ Created user ${email} (password: 123) → ${teacher.fullName}`);
  }

  console.log("\nMigration complete!");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });