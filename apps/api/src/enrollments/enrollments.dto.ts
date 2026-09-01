import { EnrollmentStatus, EnrollmentType, PaymentPeriod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class SchedulePatternDto {
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek!: number[]; // 0 = Sunday, 1 = Monday, etc.

  @IsString()
  time!: string; // HH:MM format

  @IsInt()
  @Min(30)
  duration!: number; // Duration in minutes
}

/** Один слот недельного расписания (для гибких индивидуальных графиков). */
export class ScheduleSlotDto {
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek!: number[]; // 0 = воскресенье … 6 = суббота

  @IsString()
  time!: string; // HH:MM

  @IsInt()
  @Min(15)
  duration!: number; // минут
}

export class CreateEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  teacherId!: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsEnum(EnrollmentType)
  type!: EnrollmentType;

  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  teacherCommission!: number; // Teacher's commission percentage (0-100)

  @IsOptional()
  @IsEnum(PaymentPeriod)
  paymentPeriod?: PaymentPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  @Type(() => SchedulePatternDto)
  schedulePattern?: SchedulePatternDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalLessons?: number;
}

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsEnum(EnrollmentType)
  type?: EnrollmentType;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  teacherCommission?: number;

  @IsOptional()
  @IsEnum(PaymentPeriod)
  paymentPeriod?: PaymentPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  @Type(() => SchedulePatternDto)
  schedulePattern?: SchedulePatternDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalLessons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedLessons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lessonDebt?: number;
}

export class UpdateScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  slots!: ScheduleSlotDto[];
}

export class FreezeEnrollmentDto {
  @IsDateString()
  frozenUntil!: string;

  @IsString()
  reason!: string;
}

export class UnfreezeEnrollmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class StartBreakDto {
  @IsOptional()
  @IsDateString()
  from?: string; // начало перерыва (по умолчанию — сейчас)

  @IsOptional()
  @IsDateString()
  until?: string; // дата возвращения (необязательно)

  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferGroupDto {
  @IsString()
  targetGroupId!: string;
}

export class AddLessonDebtDto {
  @IsInt()
  @Min(1)
  lessons!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
