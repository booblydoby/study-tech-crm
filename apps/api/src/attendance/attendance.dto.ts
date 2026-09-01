import { AttendanceStatus } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class AttendanceItemDto {
  @IsString()
  studentId!: string;
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
  @IsOptional()
  @IsString()
  comment?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  items!: AttendanceItemDto[];

  @IsOptional()
  @IsBoolean()
  completeLesson?: boolean;
}
