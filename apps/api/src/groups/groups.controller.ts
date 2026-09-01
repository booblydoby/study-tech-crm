import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AddStudentToGroupDto, AddTeacherToGroupDto, CreateGroupDto, UpdateGroupDto, UpdateStudentPriceDto } from "./groups.dto";
import { GroupsService } from "./groups.service";

@ApiTags("groups")
@ApiBearerAuth()
@Controller("groups")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  findAll(@Query("activeOnly") activeOnly?: string) {
    return this.groups.findAll(activeOnly === "true");
  }

  @Post()
  create(@Body() dto: CreateGroupDto) { return this.groups.create(dto); }

  @Get(":id")
  findOne(@Param("id") id: string) { return this.groups.findOne(id); }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateGroupDto) { return this.groups.update(id, dto); }

  @Delete(":id")
  remove(@Param("id") id: string) { return this.groups.remove(id); }

  @Get(":id/students")
  getStudents(@Param("id") id: string) { return this.groups.getStudents(id); }

  @Patch(":id/students/:studentId/price")
  updateStudentPrice(
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateStudentPriceDto
  ) { return this.groups.updateStudentPrice(id, studentId, dto); }

  @Delete(":id/students/:studentId/price")
  resetStudentPrice(
    @Param("id") id: string,
    @Param("studentId") studentId: string
  ) { return this.groups.resetStudentPrice(id, studentId); }

  @Post(":id/sync-prices")
  syncPrices(@Param("id") id: string) { return this.groups.syncPricesToAll(id); }

  @Post(":id/students")
  addStudent(@Param("id") id: string, @Body() dto: AddStudentToGroupDto) { return this.groups.addStudent(id, dto); }

  @Delete(":id/students/:studentId")
  removeStudent(@Param("id") id: string, @Param("studentId") studentId: string) { return this.groups.removeStudent(id, studentId); }

  @Post(":id/teachers")
  addTeacher(@Param("id") id: string, @Body() dto: AddTeacherToGroupDto) { return this.groups.addTeacher(id, dto); }

  @Get(":id/schedule")
  schedule(@Param("id") id: string) { return this.groups.schedule(id); }
}