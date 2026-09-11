import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateSubjectDto, UpdateSubjectDto } from "./subjects.dto";
import { SubjectsService } from "./subjects.service";

@ApiTags("subjects")
@ApiBearerAuth()
@Controller("subjects")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}
  @Get() findAll() {
    return this.subjects.findAll();
  }
  @Post() create(@Body() dto: CreateSubjectDto) {
    return this.subjects.create(dto);
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.subjects.findOne(id);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjects.update(id, dto);
  }
  @Delete(":id") remove(@Param("id") id: string) {
    return this.subjects.remove(id);
  }
}
