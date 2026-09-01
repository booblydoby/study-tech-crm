import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateExpenseDto, UpdateExpenseDto } from "./expenses.dto";
import { ExpensesService } from "./expenses.service";

@ApiTags("expenses")
@ApiBearerAuth()
@Controller("expenses")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@Query("from") from?: string, @Query("to") to?: string) {
    return this.expenses.findAll(from, to);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.sub, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.expenses.remove(id);
  }
}
