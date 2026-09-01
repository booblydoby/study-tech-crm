import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateSubjectDto {
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
