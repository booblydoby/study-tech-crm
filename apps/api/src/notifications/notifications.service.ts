import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { publicUserSelect } from "../common/prisma/user.select";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto, TestNotificationDto } from "./notifications.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId?: string) {
    return this.prisma.notification.findMany({
      where: userId ? { userId } : undefined,
      include: { user: { select: publicUserSelect } },
      orderBy: { createdAt: "desc" }
    });
  }

  create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({ data: dto });
  }

  test(userId: string, channel: NotificationChannel, dto: TestNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId,
        channel,
        title: `${channel} test`,
        message: dto.message ?? "Notification adapter is ready to be connected.",
        status: "PENDING"
      }
    });
  }
}
