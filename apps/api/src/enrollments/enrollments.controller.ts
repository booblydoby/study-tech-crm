import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AddLessonDebtDto, CreateEnrollmentDto, FreezeEnrollmentDto, StartBreakDto, TransferGroupDto, UnfreezeEnrollmentDto, UpdateEnrollmentDto, UpdateScheduleDto } from "./enrollments.dto";
import { EnrollmentsService } from "./enrollments.service";

@ApiTags("enrollments")
@ApiBearerAuth()
@Controller("enrollments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  findAll(@CurrentUser() user: AuthUser, @Query("studentId") studentId?: string, @Query("teacherId") teacherId?: string) {
    return this.enrollments.findAll(user, studentId, teacherId);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(dto);
  }

  @Get("teacher/:teacherId/earnings")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  getTeacherEarnings(@CurrentUser() user: AuthUser, @Param("teacherId") teacherId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.enrollments.getTeacherEarnings(user, teacherId, from, to);
  }

  @Get(":id")
  @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT)
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.enrollments.findOne(user, id);
  }

  @Patch(":id")
  @Roles(RoleName.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateEnrollmentDto) {
    return this.enrollments.update(id, dto);
  }

  @Patch(":id/schedule")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  updateSchedule(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateScheduleDto) {
    return this.enrollments.updateSchedule(user, id, dto);
  }

  @Post(":id/transfer-group")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  transferGroup(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TransferGroupDto) {
    return this.enrollments.transferToGroup(user, id, dto.targetGroupId);
  }

  @Delete(":id")
  @Roles(RoleName.ADMIN)
  remove(@Param("id") id: string) {
    return this.enrollments.remove(id);
  }

  @Post(":id/freeze")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  freeze(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: FreezeEnrollmentDto) {
    return this.enrollments.freeze(user, id, dto);
  }

  @Post(":id/unfreeze")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  unfreeze(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UnfreezeEnrollmentDto) {
    return this.enrollments.unfreeze(user, id, dto);
  }

  @Post(":id/break")
  @Roles(RoleName.ADMIN)
  startBreak(@Param("id") id: string, @Body() dto: StartBreakDto) {
    return this.enrollments.startBreak(id, dto);
  }

  @Post(":id/break/end")
  @Roles(RoleName.ADMIN)
  endBreak(@Param("id") id: string) {
    return this.enrollments.endBreak(id);
  }

  @Post(":id/lesson-debt")
  @Roles(RoleName.ADMIN)
  addLessonDebt(@Param("id") id: string, @Body() dto: AddLessonDebtDto) {
    return this.enrollments.addLessonDebt(id, dto);
  }
}
