import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { MarkAttendanceDto } from "./attendance.dto";
import { AttendanceService } from "./attendance.service";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get() @Roles(RoleName.ADMIN) findAll() { return this.attendance.findAll(); }
  @Post("lesson/:lessonId") @Roles(RoleName.ADMIN, RoleName.TEACHER) mark(@Param("lessonId") lessonId: string, @CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) { return this.attendance.markLesson(lessonId, user, dto); }
  @Get("lesson/:lessonId") @Roles(RoleName.ADMIN, RoleName.TEACHER) byLesson(@CurrentUser() user: AuthUser, @Param("lessonId") lessonId: string) { return this.attendance.byLesson(user, lessonId); }
  @Get("student/:studentId") @Roles(RoleName.ADMIN, RoleName.TEACHER, RoleName.STUDENT) byStudent(@CurrentUser() user: AuthUser, @Param("studentId") studentId: string) { return this.attendance.byStudent(user, studentId); }
}
