import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NotificationChannel, RoleName } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateNotificationDto, TestNotificationDto } from "./notifications.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  findAll(@Query("userId") userId?: string) {
    return this.notifications.findAll(userId);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.create(dto);
  }

  @Post("test-email")
  @Roles(RoleName.ADMIN)
  testEmail(@CurrentUser() user: { sub: string }, @Body() dto: TestNotificationDto) {
    return this.notifications.test(user.sub, NotificationChannel.EMAIL, dto);
  }

  @Post("test-telegram")
  @Roles(RoleName.ADMIN)
  testTelegram(@CurrentUser() user: { sub: string }, @Body() dto: TestNotificationDto) {
    return this.notifications.test(user.sub, NotificationChannel.TELEGRAM, dto);
  }
}
