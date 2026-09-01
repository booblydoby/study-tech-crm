import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get("dashboard") dashboard() { return this.analytics.dashboard(); }
  @Get("revenue") revenue() { return this.analytics.revenue(); }
  @Get("debts") debts() { return this.analytics.debts(); }
  @Get("attendance") attendance() { return this.analytics.attendance(); }
  @Get("money-debt") moneyDebt() { return this.analytics.moneyDebt(); }
  @Get("payment-due") paymentDue(@Query("daysAhead") daysAhead?: string) {
    const parsed = daysAhead ? Number.parseInt(daysAhead, 10) : 14;
    return this.analytics.paymentDueStatus(Number.isFinite(parsed) && parsed > 0 ? parsed : 14);
  }
  @Post("reconcile") reconcile() { return this.analytics.reconcile(); }
  @Get("profit") profit(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analytics.profitSummary(from, to);
  }
}
