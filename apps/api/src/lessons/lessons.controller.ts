import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  CancelLessonDto,
  CancelLessonWithOptionsDto,
  ClearScheduleDto,
  CreateLessonDto,
  GenerateScheduleDto,
  RescheduleLessonDto,
  UpdateLessonDto
} from "./lessons.dto";
import { LessonsService } from "./lessons.service";

@ApiTags("lessons")
@ApiBearerAuth()
@Controller("lessons")
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}
  @Get() @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT) findAll(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("teacherId") teacherId?: string,
    @Query("studentId") studentId?: string,
    @Query("groupId") groupId?: string
  ) {
    return this.lessons.findAll(user, from, to, teacherId, studentId, groupId);
  }
  @Post() @Roles(RoleName.ADMIN, RoleName.TEACHER) create(@CurrentUser() user: AuthUser, @Body() dto: CreateLessonDto) {
    return this.lessons.create(user, dto);
  }
  @Post("clear-future-schedule")
  @Roles(RoleName.ADMIN)
  clearFutureSchedule(@Body() dto: ClearScheduleDto) {
    return this.lessons.clearFutureGroupLessons(dto.groupId);
  }

  @Post("generate-schedule")
  @Roles(RoleName.ADMIN)
  generateSchedule(@Body() dto: GenerateScheduleDto) {
    return this.lessons.generateFromGroups(dto.weeks ?? 4, dto.replaceFuture ?? false);
  }

  @Get(":id/roster") @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT) getRoster(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.lessons.getLessonRoster(user, id);
  }
  @Get(":id") @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT) findOne(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.lessons.findOne(user, id);
  }
  @Patch(":id") @Roles(RoleName.ADMIN, RoleName.TEACHER) update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateLessonDto
  ) {
    return this.lessons.update(user, id, dto);
  }
  @Delete(":id") @Roles(RoleName.ADMIN, RoleName.TEACHER) remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.lessons.remove(user, id);
  }
  @Post(":id/cancel") @Roles(RoleName.ADMIN, RoleName.TEACHER) cancel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelLessonDto
  ) {
    return this.lessons.cancel(user, id, dto);
  }
  @Post(":id/cancel-options") @Roles(RoleName.ADMIN, RoleName.TEACHER) cancelWithOptions(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelLessonWithOptionsDto
  ) {
    return this.lessons.cancelWithOptions(user, id, dto);
  }
  @Post(":id/reschedule") @Roles(RoleName.ADMIN, RoleName.TEACHER) createReplacement(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: RescheduleLessonDto
  ) {
    return this.lessons.createReplacement(user, id, dto);
  }
  @Post(":id/move") @Roles(RoleName.ADMIN, RoleName.TEACHER) move(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateLessonDto
  ) {
    return this.lessons.move(user, id, dto);
  }
  @Post(":id/complete") @Roles(RoleName.ADMIN, RoleName.TEACHER) markCompleted(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.lessons.markCompleted(user, id);
  }
  @Post(":id/reopen") @Roles(RoleName.ADMIN, RoleName.TEACHER) reopen(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.lessons.reopenLesson(user, id);
  }
}
