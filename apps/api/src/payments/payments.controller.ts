import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreatePaymentDto, PaymentCyclePreviewDto, UpdatePaymentDto } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("payments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  findAll(@CurrentUser() user: AuthUser) {
    return this.payments.findAll(user);
  }

  @Post("cycle-preview")
  @Roles(RoleName.ADMIN)
  previewCycle(@Body() dto: PaymentCyclePreviewDto) {
    return this.payments.previewCycle(dto);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user.sub, dto);
  }

  @Get("debts")
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  debts(@CurrentUser() user: AuthUser) {
    return this.payments.debts(user);
  }

  @Get("upcoming")
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  upcoming(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    return this.payments.upcoming(user, days ? Number(days) : 7);
  }

  @Get(":id")
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.payments.findOne(user, id);
  }

  @Patch(":id")
  @Roles(RoleName.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdatePaymentDto) {
    return this.payments.update(id, dto);
  }

  @Delete(":id")
  @Roles(RoleName.ADMIN)
  remove(@Param("id") id: string) {
    return this.payments.remove(id);
  }
}
