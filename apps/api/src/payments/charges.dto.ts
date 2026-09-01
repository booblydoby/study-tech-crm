import { PaymentMethod, PaymentPeriod } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class CreateChargeDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() enrollmentId?: string;

  // Сколько нужно заплатить за цикл (вводится вручную).
  @IsInt() @Min(1) dueAmount!: number;

  // Дата начала цикла / первого взноса.
  @IsDateString() paidAt!: string;

  @IsOptional() @IsInt() @Min(1) lessonsInCycle?: number;
  @IsOptional() @IsEnum(PaymentPeriod) paymentPeriod?: PaymentPeriod;

  // Ручной период, если начисление не привязано к записи.
  @ValidateIf((dto: CreateChargeDto) => !dto.enrollmentId)
  @IsDateString()
  periodFrom?: string;

  @ValidateIf((dto: CreateChargeDto) => !dto.enrollmentId)
  @IsDateString()
  periodTo?: string;

  // Необязательный первый взнос при создании начисления.
  @IsOptional() @IsInt() @Min(0) firstAmount?: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;

  @IsOptional() @IsString() comment?: string;
}

export class AddInstallmentDto {
  @IsInt() @Min(1) amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsDateString() paidAt!: string;
  @IsOptional() @IsString() comment?: string;
}

export class UpdateChargeDto {
  @IsOptional() @IsInt() @Min(1) dueAmount?: number;
  @IsOptional() @IsString() comment?: string;
}
