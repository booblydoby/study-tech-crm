import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateTemporaryPassword } from "../common/utils/password";
import { CreateTeacherDto, UpdateTeacherDto } from "./teachers.dto";

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.teacher.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { fullName: "asc" }
    });
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        enrollments: { include: { student: true, subject: true, group: true } },
        groups: { include: { group: true } }
      }
    });
    if (!teacher) throw new NotFoundException("Teacher not found");
    return teacher;
  }

  async create(dto: CreateTeacherDto) {
    return this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      let temporaryPassword: string | undefined;

      const login = (dto.login || dto.email)?.trim().toLowerCase();
      if (login) {
        const existingUser = await tx.user.findUnique({ where: { email: login } });
        if (existingUser) {
          throw new BadRequestException(`User with login "${login}" already exists`);
        }

        const plainPassword = dto.password ?? generateTemporaryPassword();
        if (!dto.password) {
          temporaryPassword = plainPassword;
        }
        if (plainPassword.length < 8) {
          throw new BadRequestException("Password must be at least 8 characters");
        }

        const hashedPassword = await import("argon2").then((m) => m.hash(plainPassword));
        const teacherRole = await tx.role.findUnique({ where: { name: "TEACHER" } });
        if (!teacherRole) {
          throw new BadRequestException("Teacher role is not configured");
        }

        const user = await tx.user.create({
          data: {
            email: login,
            fullName: dto.fullName,
            passwordHash: hashedPassword,
            roleId: teacherRole.id
          }
        });
        userId = user.id;
      } else if (dto.email) {
        const existingUser = await tx.user.findUnique({
          where: { email: dto.email.trim().toLowerCase() }
        });
        if (existingUser) userId = existingUser.id;
      }

      const teacher = await tx.teacher.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          specialization: dto.specialization,
          avatarId: dto.avatarId ?? 1,
          userId
        },
        include: { user: { select: { email: true } } }
      });

      return temporaryPassword ? { ...teacher, temporaryPassword } : teacher;
    });
  }

  async update(id: string, dto: UpdateTeacherDto) {
    await this.findOne(id);
    return this.prisma.teacher.update({
      where: { id },
      data: dto,
      include: { user: { select: { email: true } } }
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.teacher.update({
      where: { id },
      data: { isActive: false }
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const teacher = await this.findOne(id);
    if (!teacher.userId) throw new NotFoundException("Teacher has no user account");
    if (newPassword.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const hashedPassword = await import("argon2").then((m) => m.hash(newPassword));
    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash: hashedPassword }
    });
    return { ok: true };
  }

  schedule(id: string) {
    return this.prisma.lesson.findMany({
      where: { teacherId: id },
      include: {
        enrollment: { include: { student: true } },
        group: true,
        student: true,
        subject: true
      },
      orderBy: { startsAt: "asc" }
    });
  }

  async mySchedule(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException("Teacher profile not found for current user");
    return this.schedule(teacher.id);
  }

  async myGroups(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException("Teacher profile not found for current user");
    return this.prisma.group.findMany({
      where: { status: "ACTIVE", teachers: { some: { teacherId: teacher.id } } },
      include: { subject: true },
      orderBy: { name: "asc" }
    });
  }

  async recordPayout(teacherId: string, recordedById: string, amount: number, paidAt: Date, comment?: string) {
    await this.findOne(teacherId);
    return this.prisma.teacherPayout.create({
      data: { teacherId, amount, paidAt, comment, recordedById }
    });
  }

  workload(id: string) {
    return this.prisma.lesson.groupBy({
      by: ["status"],
      where: { teacherId: id },
      _count: true
    });
  }
}
