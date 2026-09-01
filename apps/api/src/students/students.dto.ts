import { PaymentPeriod, StudentStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { ScheduleSlotDto } from "../enrollments/enrollments.dto";

export class CreateStudentDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  password?: string;

  // Групповые занятия: список групп (можно совмещать с индивидуальными).
  @IsOptional()
  @IsString({ each: true })
  groupIds?: string[];

  // Индивидуальные занятия: предмет + преподаватель + недельное расписание (слоты).
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  scheduleSlots?: ScheduleSlotDto[];

  @IsOptional()
  @IsEnum(PaymentPeriod)
  paymentPeriod?: PaymentPeriod;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  teacherCommission?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalLessons?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  avatarId?: number;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  avatarId?: number;
}

export class ResetStudentPasswordDto {
  @IsString()
  newPassword!: string;
}

export class CreateStudentNoteDto {
  @IsString()
  content!: string;
}
