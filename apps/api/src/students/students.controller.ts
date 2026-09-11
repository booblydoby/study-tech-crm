import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateStudentDto, CreateStudentNoteDto, ResetStudentPasswordDto, UpdateStudentDto } from "./students.dto";
import { StudentsService } from "./students.service";

@ApiTags("students")
@ApiBearerAuth()
@Controller("students")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  findAll(@CurrentUser() user: { role: string; teacherId?: string }, @Query("search") search?: string) {
    return this.students.findAll(user, search);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Get("me")
  @Roles(RoleName.STUDENT)
  me(@CurrentUser() user: { sub: string }) {
    return this.students.findMe(user.sub);
  }

  @Get(":id")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  findOne(@CurrentUser() user: { role: string; teacherId?: string }, @Param("id") id: string) {
    return this.students.findOne(id, user);
  }

  @Patch(":id")
  @Roles(RoleName.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Delete(":id")
  @Roles(RoleName.ADMIN)
  remove(@Param("id") id: string) {
    return this.students.remove(id);
  }

  @Get(":id/history")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  history(@CurrentUser() user: { role: string; teacherId?: string }, @Param("id") id: string) {
    return this.students.history(id, user);
  }

  @Post(":id/reset-password")
  @Roles(RoleName.ADMIN)
  resetPassword(@Param("id") id: string, @Body() dto: ResetStudentPasswordDto) {
    return this.students.resetPassword(id, dto);
  }

  @Post(":id/notes")
  @Roles(RoleName.ADMIN, RoleName.TEACHER)
  addNote(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; role: string; teacherId?: string },
    @Body() dto: CreateStudentNoteDto
  ) {
    return this.students.addNote(id, user.sub, dto, user);
  }
}
