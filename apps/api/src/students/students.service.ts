import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EnrollmentType, Prisma, RoleName } from "@prisma/client";
import { getLessonOccurrences } from "../common/utils/lesson-schedule";
import { toInputJson } from "../common/utils/prisma-json";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStudentDto, CreateStudentNoteDto, ResetStudentPasswordDto, UpdateStudentDto } from "./students.dto";

type StudentAccessUser = { role: string; teacherId?: string };

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private visibleStudentWhere(user?: StudentAccessUser): Prisma.StudentWhereInput {
    if (!user || user.role === RoleName.ADMIN) return {};
    if (user.role === RoleName.TEACHER) {
      if (!user.teacherId) throw new ForbiddenException("Teacher profile is required");
      return {
        OR: [
          { enrollments: { some: { teacherId: user.teacherId } } },
          { groups: { some: { group: { teachers: { some: { teacherId: user.teacherId } } } } } }
        ]
      };
    }
    throw new ForbiddenException("Access denied");
  }

  findAll(user?: StudentAccessUser, search?: string) {
    return this.prisma.student.findMany({
      where: {
        AND: [
          this.visibleStudentWhere(user),
          search ? { fullName: { contains: search, mode: "insensitive" } } : {}
        ]
      },
      include: {
        enrollments: {
          where: { status: { not: "CANCELLED" } },
          include: { subject: true, teacher: true, group: true },
          orderBy: { createdAt: "desc" }
        },
        groups: { include: { group: { include: { subject: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string, user?: StudentAccessUser) {
    const student = await this.prisma.student.findFirst({
      where: { id, AND: [this.visibleStudentWhere(user)] },
      include: {
        user: { select: { email: true } },
        enrollments: {
          where: { status: { not: "CANCELLED" } },
          include: {
            subject: true,
            teacher: true,
            group: true,
            payments: { orderBy: { paidAt: "desc" } },
            lessons: { orderBy: { startsAt: "asc" } }
          },
          orderBy: { createdAt: "desc" }
        },
        groups: { include: { group: { include: { subject: true, teachers: { include: { teacher: true } } } } } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        charges: {
          include: {
            enrollment: { include: { subject: true } },
            payments: { orderBy: { paidAt: "asc" } }
          },
          orderBy: { createdAt: "desc" }
        },
        payments: { include: { enrollment: { include: { subject: true } } }, orderBy: { paidAt: "desc" } }
      }
    });
    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  async findMe(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: { include: { subject: true, teacher: true, group: true, payments: { orderBy: { paidAt: "desc" } } } },
        attendance: { include: { lesson: { include: { subject: true, teacher: true, group: true } } }, orderBy: { createdAt: "desc" } },
        payments: { include: { enrollment: { include: { subject: true, teacher: true, group: true } } }, orderBy: { paidAt: "desc" } }
      }
    });
    if (!student) throw new NotFoundException("Student profile not found");
    return student;
  }

  async create(dto: CreateStudentDto) {
    return this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      
      // If login and password provided, create a user account for the student
      const login = (dto.login || dto.email)?.trim().toLowerCase();
      if (login && dto.password) {
        const existingUser = await tx.user.findUnique({ where: { email: login } });
        if (existingUser) {
          throw new BadRequestException(`User with login "${login}" already exists`);
        }

        const hashedPassword = await import("argon2").then(m => m.hash(dto.password!));
        const studentRole = await tx.role.findUnique({ where: { name: "STUDENT" } });
        
        const user = await tx.user.create({
          data: {
            email: login,
            fullName: dto.fullName,
            passwordHash: hashedPassword,
            roleId: studentRole!.id
          }
        });
        userId = user.id;
      }

      const student = await tx.student.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          parentPhone: dto.parentPhone,
          telegram: dto.telegram,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          source: dto.source,
          avatarId: dto.avatarId ?? 1,
          userId
        }
      });

      // Групповые занятия: можно совмещать с индивидуальными.
      if (dto.groupIds && dto.groupIds.length > 0) {
        for (const groupId of dto.groupIds) {
          const group = await tx.group.findUnique({
            where: { id: groupId },
            include: { teachers: true }
          });

          if (group) {
            const price = group.monthlyPrice;
            const teacherId = group.teachers.length > 0 ? group.teachers[0].teacherId : undefined;

            if (teacherId) {
              await tx.enrollment.create({
                data: {
                  studentId: student.id,
                  subjectId: group.subjectId,
                  teacherId,
                  groupId,
                  type: EnrollmentType.GROUP,
                  price,
                  teacherCommission: dto.teacherCommission ?? 0,
                  schedulePattern: toInputJson(group.schedulePattern),
                  totalLessons: dto.totalLessons ?? null
                }
              });

              await tx.studentGroup.upsert({
                where: { studentId_groupId: { studentId: student.id, groupId } },
                create: { studentId: student.id, groupId, price },
                update: { status: "ACTIVE", leftAt: null, price }
              });
            }
          }
        }
      }

      // Индивидуальные занятия: создаём, если задан предмет/преподаватель/расписание.
      const hasIndividual = Boolean(dto.subjectId || dto.teacherId || dto.scheduleSlots?.length);
      if (hasIndividual) {
        if (!dto.subjectId || !dto.teacherId) {
          throw new BadRequestException("Для индивидуального занятия укажите предмет и преподавателя");
        }
        if (!dto.price || dto.price < 1) {
          throw new BadRequestException("Укажите стоимость индивидуального занятия");
        }
        const slots = (dto.scheduleSlots ?? []).filter((slot) => slot.daysOfWeek?.length);
        if (!slots.length) {
          throw new BadRequestException("Укажите расписание индивидуального занятия");
        }

        const schedulePattern = { slots };

        const individualEnrollment = await tx.enrollment.create({
          data: {
            studentId: student.id,
            subjectId: dto.subjectId,
            teacherId: dto.teacherId,
            type: EnrollmentType.INDIVIDUAL,
            price: dto.price,
            teacherCommission: dto.teacherCommission ?? 0,
            paymentPeriod: dto.paymentPeriod ?? "PER_LESSON",
            schedulePattern: toInputJson(schedulePattern),
            totalLessons: dto.totalLessons ?? null
          }
        });

        // Сразу создаём занятия на 4 недели вперёд, чтобы они появились в расписании.
        const from = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 28);
        try {
          const occurrences = getLessonOccurrences(schedulePattern, from, 200).filter(
            (occ) => occ.startsAt <= to
          );
          for (const { startsAt, duration } of occurrences) {
            await tx.lesson.create({
              data: {
                type: "INDIVIDUAL",
                studentId: student.id,
                enrollmentId: individualEnrollment.id,
                teacherId: dto.teacherId,
                subjectId: dto.subjectId,
                startsAt,
                endsAt: new Date(startsAt.getTime() + duration * 60_000)
              }
            });
          }
        } catch {
          // Некорректное расписание — занятия можно создать позже через «Сгенерировать».
        }
      }

      return student;
    });
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.findOne(id);
    return this.prisma.student.update({
      where: { id },
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined }
    });
  }

  async remove(id: string) {
    const student = await this.findOne(id);
    // Delete related records first
    await this.prisma.studentNote.deleteMany({ where: { studentId: id } });
    await this.prisma.attendance.deleteMany({ where: { studentId: id } });
    await this.prisma.payment.deleteMany({ where: { studentId: id } });
    await this.prisma.studentGroup.deleteMany({ where: { studentId: id } });
    await this.prisma.enrollment.deleteMany({ where: { studentId: id } });
    // Delete associated user if exists
    const studentWithUser = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true }
    });
    if (studentWithUser?.userId) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: studentWithUser.userId } });
      await this.prisma.user.delete({ where: { id: studentWithUser.userId } }).catch(() => {});
    }
    // Finally delete the student
    return this.prisma.student.delete({ where: { id } });
  }

  async resetPassword(id: string, dto: ResetStudentPasswordDto) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true }
    });
    if (!student?.userId) throw new BadRequestException("Student has no user account");

    const hashedPassword = await import("argon2").then(m => m.hash(dto.newPassword));
    return this.prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash: hashedPassword }
    });
  }

  async addNote(studentId: string, authorId: string, dto: CreateStudentNoteDto, user?: StudentAccessUser) {
    await this.findOne(studentId, user);
    return this.prisma.studentNote.create({ data: { studentId, authorId, content: dto.content } });
  }

  history(id: string, user?: StudentAccessUser) {
    return this.prisma.student.findFirst({
      where: { id, AND: [this.visibleStudentWhere(user)] },
      include: {
        enrollments: { include: { subject: true, teacher: true, group: true } },
        groups: { include: { group: true } },
        attendance: { include: { lesson: { include: { group: true, subject: true, enrollment: true } } }, orderBy: { createdAt: "desc" } },
        payments: { include: { enrollment: { include: { subject: true, teacher: true, group: true } } }, orderBy: { paidAt: "desc" } }
      }
    });
  }
}
