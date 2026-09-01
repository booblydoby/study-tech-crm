import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AddInstallmentDto, CreateChargeDto, UpdateChargeDto } from "./charges.dto";
import { ChargesService } from "./charges.service";

@ApiTags("charges")
@ApiBearerAuth()
@Controller("charges")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Get()
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  findAll(@CurrentUser() user: AuthUser) {
    return this.charges.findAll(user);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChargeDto) {
    return this.charges.create(user.sub, dto);
  }

  @Delete("payments/:paymentId")
  @Roles(RoleName.ADMIN)
  removeInstallment(@Param("paymentId") paymentId: string) {
    return this.charges.removeInstallment(paymentId);
  }

  @Post(":id/payments")
  @Roles(RoleName.ADMIN)
  addInstallment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AddInstallmentDto) {
    return this.charges.addInstallment(user.sub, id, dto);
  }

  @Patch(":id")
  @Roles(RoleName.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateChargeDto) {
    return this.charges.update(id, dto);
  }

  @Delete(":id")
  @Roles(RoleName.ADMIN)
  remove(@Param("id") id: string) {
    return this.charges.remove(id);
  }
}
