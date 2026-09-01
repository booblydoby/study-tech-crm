import { PaymentMethod, PaymentPeriod } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class CreatePaymentDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsInt() @Min(1) amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsDateString() paidAt!: string;

  @IsOptional() @IsInt() @Min(1) lessonsInCycle?: number;

  @IsOptional() @IsEnum(PaymentPeriod) paymentPeriod?: PaymentPeriod;

  @ValidateIf((dto: CreatePaymentDto) => !dto.enrollmentId)
  @IsDateString()
  periodFrom?: string;

  @ValidateIf((dto: CreatePaymentDto) => !dto.enrollmentId)
  @IsDateString()
  periodTo?: string;

  @IsOptional() @IsString() comment?: string;
}

export class PaymentCyclePreviewDto {
  @IsString() enrollmentId!: string;
  @IsDateString() paidAt!: string;
  @IsOptional() @IsInt() @Min(1) lessonsInCycle?: number;
  @IsOptional() @IsEnum(PaymentPeriod) paymentPeriod?: PaymentPeriod;
}

export class UpdatePaymentDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsOptional() @IsInt() @Min(1) amount?: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsDateString() periodFrom?: string;
  @IsOptional() @IsDateString() periodTo?: string;
  @IsOptional() @IsInt() @Min(1) lessonsInCycle?: number;
  @IsOptional() @IsEnum(PaymentPeriod) paymentPeriod?: PaymentPeriod;
  @IsOptional() @IsDateString() nextPaymentDue?: string;
  @IsOptional() @IsString() comment?: string;
}
