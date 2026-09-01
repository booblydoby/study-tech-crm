import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuthModule } from "./auth/auth.module";
import { validateEnv } from "./config/env.schema";
import { EnrollmentsModule } from "./enrollments/enrollments.module";
import { GroupsModule } from "./groups/groups.module";
import { LessonsModule } from "./lessons/lessons.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StudentsModule } from "./students/students.module";
import { SubjectsModule } from "./subjects/subjects.module";
import { TeachersModule } from "./teachers/teachers.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    EnrollmentsModule,
    TeachersModule,
    SubjectsModule,
    GroupsModule,
    LessonsModule,
    AttendanceModule,
    PaymentsModule,
    AnalyticsModule,
    ExpensesModule,
    NotificationsModule
  ]
})
export class AppModule {}
