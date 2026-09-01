import { Module } from "@nestjs/common";
import { AttendanceModule } from "../attendance/attendance.module";
import { ExpensesModule } from "../expenses/expenses.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [ExpensesModule, AttendanceModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}
