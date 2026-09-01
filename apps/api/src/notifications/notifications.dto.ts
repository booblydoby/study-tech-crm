import { NotificationChannel } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  title!: string;

  @IsString()
  message!: string;
}

export class TestNotificationDto {
  @IsOptional()
  @IsString()
  message?: string;
}
