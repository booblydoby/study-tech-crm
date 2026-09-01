import { IsBoolean, IsDateString, IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateTeacherDto {
  @IsString()
  fullName!: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsEmail()
  email?: string;
  @IsOptional()
  @IsString()
  specialization?: string;
  @IsOptional()
  @IsString()
  userId?: string;
  @IsOptional()
  @IsString()
  login?: string;
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  avatarId?: number;
}

export class ResetTeacherPasswordDto {
  @IsString()
  newPassword!: string;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  avatarId?: number;
}

export class CreateTeacherPayoutDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
