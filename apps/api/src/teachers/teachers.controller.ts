import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateTeacherDto, CreateTeacherPayoutDto, ResetTeacherPasswordDto, UpdateTeacherDto } from "./teachers.dto";
import { TeachersService } from "./teachers.service";

@ApiTags("teachers")
@ApiBearerAuth()
@Controller("teachers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  findAll() { return this.teachers.findAll(); }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@Body() dto: CreateTeacherDto) { return this.teachers.create(dto); }

  @Get("me/schedule")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  mySchedule(@CurrentUser() user: AuthUser) { return this.teachers.mySchedule(user.sub); }

  @Get("me/groups")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  myGroups(@CurrentUser() user: AuthUser) { return this.teachers.myGroups(user.sub); }

  @Get(":id")
  @Roles(RoleName.ADMIN)
  findOne(@Param("id") id: string) { return this.teachers.findOne(id); }

  @Patch(":id")
  @Roles(RoleName.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateTeacherDto) { return this.teachers.update(id, dto); }

  @Delete(":id")
  @Roles(RoleName.ADMIN)
  remove(@Param("id") id: string) { return this.teachers.remove(id); }

  @Post(":id/reset-password")
  @Roles(RoleName.ADMIN)
  resetPassword(@Param("id") id: string, @Body() dto: ResetTeacherPasswordDto) { return this.teachers.resetPassword(id, dto.newPassword); }

  @Post(":id/payouts")
  @Roles(RoleName.ADMIN)
  recordPayout(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateTeacherPayoutDto) {
    return this.teachers.recordPayout(id, user.sub, dto.amount, new Date(dto.paidAt), dto.comment);
  }

  @Get(":id/schedule")
  @Roles(RoleName.ADMIN)
  schedule(@Param("id") id: string) { return this.teachers.schedule(id); }

  @Get(":id/workload")
  @Roles(RoleName.ADMIN)
  workload(@Param("id") id: string) { return this.teachers.workload(id); }
}
