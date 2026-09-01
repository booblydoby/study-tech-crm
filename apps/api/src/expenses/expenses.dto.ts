import { ExpenseCategory } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsDateString()
  spentAt!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsDateString()
  spentAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
