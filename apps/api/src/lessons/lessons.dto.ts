import { LessonStatus, LessonType } from "@prisma/client";
import { Type, Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

// Prisma enums from schema - ensures compatibility with generated client
export enum LessonCancellationReason {
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  WEATHER = "WEATHER",
  ILLNESS = "ILLNESS",
  OTHER = "OTHER"
}

export class CreateLessonDto {
  @IsOptional() @IsEnum(LessonType) type?: LessonType;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsString() teacherId!: string;
  @IsString() subjectId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}

export class UpdateLessonDto {
  @IsOptional() @IsEnum(LessonType) type?: LessonType;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsEnum(LessonStatus) status?: LessonStatus;
  @IsOptional() @IsString() cancellationReason?: string;
}

export class CancelLessonDto {
  @IsString() reason!: string;
  @IsEnum(LessonCancellationReason) cancellationType!: LessonCancellationReason;
}

export class CancelLessonWithOptionsDto {
  @IsString() reason!: string;
  @IsEnum(LessonCancellationReason) cancellationType!: LessonCancellationReason;
  @IsOptional() @IsString() action?: "add_debt" | "reschedule" | "adjust_payment";
  @IsOptional() @IsDateString() newStartsAt?: string;
  @IsOptional() @IsDateString() newEndsAt?: string;
}

export class RescheduleLessonDto {
  @IsDateString() newStartsAt!: string;
  @IsDateString() newEndsAt!: string;
}

export class GenerateScheduleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weeks?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  replaceFuture?: boolean;
}

export class ClearScheduleDto {
  @IsOptional()
  @IsString()
  groupId?: string;
}