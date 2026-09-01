import { GroupStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class CreateGroupDto {
  @IsString()
  name!: string;
  @IsString()
  subjectId!: string;
  @IsString()
  teacherId!: string;
  @IsInt()
  @Min(0)
  monthlyPrice!: number;
  @IsOptional()
  @IsObject()
  schedulePattern?: Record<string, unknown>;
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  subjectId?: string;
  @IsOptional()
  @IsString()
  teacherId?: string;
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPrice?: number;
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;
  @IsOptional()
  @IsObject()
  schedulePattern?: Record<string, unknown>;
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class AddStudentToGroupDto {
  @IsString()
  studentId!: string;

  /** С какой даты ученик начинает посещать занятия группы (по умолчанию — сегодня). */
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class AddTeacherToGroupDto {
  @IsString()
  teacherId!: string;
}

export class UpdateStudentPriceDto {
  @IsInt()
  @Min(0)
  price!: number;
}

export class SyncPricesDto {} // Empty body, just triggers sync