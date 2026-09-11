import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { GroupStatus, Prisma } from "@prisma/client";
import { toInputJson } from "../common/utils/prisma-json";
import { syncOpenChargesForEnrollment } from "../common/utils/charge-sync";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddStudentToGroupDto,
  AddTeacherToGroupDto,
  CreateGroupDto,
  UpdateGroupDto,
  UpdateStudentPriceDto
} from "./groups.dto";

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(activeOnly?: boolean) {
    return this.prisma.group.findMany({
      where: activeOnly ? { status: GroupStatus.ACTIVE } : undefined,
      include: {
        subject: true,
        teachers: { include: { teacher: true } },
        students: { where: { status: "ACTIVE" }, include: { student: true } },
        enrollments: { include: { student: true, teacher: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        subject: true,
        teachers: { include: { teacher: true } },
        students: { include: { student: true } },
        enrollments: { include: { student: true, teacher: true } },
        lessons: true
      }
    });
    if (!group) throw new NotFoundException("Group not found");
    return group;
  }

  async create(dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        subjectId: dto.subjectId,
        monthlyPrice: dto.monthlyPrice,
        schedulePattern: toInputJson(dto.schedulePattern),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined
      }
    });

    if (dto.teacherId) {
      await this.prisma.groupTeacher.create({
        data: { groupId: group.id, teacherId: dto.teacherId }
      });
    }

    return this.findOne(group.id);
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findOne(id);

    const data: Prisma.GroupUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.subjectId !== undefined) data.subject = { connect: { id: dto.subjectId } };
    if (dto.monthlyPrice !== undefined) data.monthlyPrice = dto.monthlyPrice;
    if (dto.schedulePattern !== undefined) data.schedulePattern = toInputJson(dto.schedulePattern);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);

    if (dto.teacherId !== undefined) {
      await this.prisma.groupTeacher.deleteMany({ where: { groupId: id } });
      await this.prisma.groupTeacher.create({
        data: { groupId: id, teacherId: dto.teacherId }
      });
    }

    const updated = await this.prisma.group.update({
      where: { id },
      data,
      include: {
        subject: true,
        teachers: { include: { teacher: true } },
        students: { include: { student: true } },
        enrollments: true
      }
    });

    if (dto.schedulePattern !== undefined) {
      await this.prisma.enrollment.updateMany({
        where: { groupId: id, status: { not: "CANCELLED" } },
        data: { schedulePattern: toInputJson(dto.schedulePattern) }
      });
    }

    if (dto.monthlyPrice !== undefined) {
      await this.propagateGroupPriceToEnrollments(id, dto.monthlyPrice, true);
    }

    return updated;
  }

  /** Обновляет enrollment.price и открытые начисления для учеников группы. */
  private async propagateGroupPriceToEnrollments(
    groupId: string,
    monthlyPrice: number,
    onlyWithoutCustomPrice: boolean
  ) {
    const studentGroups = await this.prisma.studentGroup.findMany({
      where: { groupId, status: "ACTIVE" },
      select: { studentId: true, price: true }
    });

    for (const sg of studentGroups) {
      if (onlyWithoutCustomPrice && sg.price !== null) continue;

      const enrollment = await this.prisma.enrollment.findFirst({
        where: { studentId: sg.studentId, groupId, status: { not: "CANCELLED" } }
      });
      if (!enrollment) continue;

      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { price: monthlyPrice }
      });
      await syncOpenChargesForEnrollment(this.prisma, enrollment.id, monthlyPrice);
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.attendance.deleteMany({ where: { lesson: { groupId: id } } }),
      this.prisma.lesson.deleteMany({ where: { groupId: id } }),
      // Удаляем групповые записи студентов целиком, иначе остаются "висячие"
      // enrollments с type=GROUP и groupId=null, и ученики выглядят привязанными к удалённой группе.
      this.prisma.enrollment.deleteMany({ where: { groupId: id } }),
      this.prisma.studentGroup.deleteMany({ where: { groupId: id } }),
      this.prisma.groupTeacher.deleteMany({ where: { groupId: id } }),
      this.prisma.group.delete({ where: { id } })
    ]);

    return { ok: true };
  }

  async addStudent(groupId: string, dto: AddStudentToGroupDto) {
    const group = await this.findOne(groupId);
    const teacherId = group.teachers[0]?.teacherId;
    if (!teacherId) {
      throw new BadRequestException("Назначьте преподавателя группе перед добавлением студентов");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    await this.prisma.$transaction(async (tx) => {
      const existingEnrollment = await tx.enrollment.findFirst({
        where: {
          studentId: dto.studentId,
          groupId,
          status: { not: "CANCELLED" }
        }
      });

      if (!existingEnrollment) {
        await tx.enrollment.create({
          data: {
            studentId: dto.studentId,
            subjectId: group.subjectId,
            teacherId,
            groupId,
            type: "GROUP",
            price: group.monthlyPrice,
            schedulePattern: toInputJson(group.schedulePattern),
            startDate
          }
        });
      } else {
        await tx.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: "ACTIVE",
            endDate: null,
            startDate
          }
        });
      }

      await tx.studentGroup.upsert({
        where: { studentId_groupId: { studentId: dto.studentId, groupId } },
        create: { studentId: dto.studentId, groupId, joinedAt: startDate },
        update: { status: "ACTIVE", leftAt: null, joinedAt: startDate }
      });

      // Убираем ошибочную посещаемость за дни до начала занятий.
      await tx.attendance.deleteMany({
        where: {
          studentId: dto.studentId,
          lesson: { groupId, startsAt: { lt: startDate } }
        }
      });
    });

    return this.getStudents(groupId);
  }

  async removeStudent(groupId: string, studentId: string) {
    await this.findOne(groupId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.studentGroup.update({
        where: { studentId_groupId: { studentId, groupId } },
        data: { status: "LEFT", leftAt: now }
      });

      // Завершаем групповую запись, иначе она остаётся ACTIVE и продолжает
      // учитываться в аналитике, долгах и списке оплат (рассинхрон при переводе в другую группу).
      await tx.enrollment.updateMany({
        where: { studentId, groupId, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED", endDate: now }
      });

      // Подчищаем возможную посещаемость для будущих незавершённых занятий группы.
      await tx.attendance.deleteMany({
        where: {
          studentId,
          lesson: { groupId, startsAt: { gte: now }, status: "SCHEDULED" }
        }
      });
    });

    return this.getStudents(groupId);
  }

  addTeacher(groupId: string, dto: AddTeacherToGroupDto) {
    return this.prisma.groupTeacher.upsert({
      where: { groupId_teacherId: { groupId, teacherId: dto.teacherId } },
      create: { groupId, teacherId: dto.teacherId },
      update: {}
    });
  }

  schedule(groupId: string) {
    return this.prisma.lesson.findMany({
      where: { groupId },
      include: { teacher: true, subject: true, enrollment: { include: { student: true } } },
      orderBy: { startsAt: "asc" }
    });
  }

  async getStudents(groupId: string) {
    const group = await this.findOne(groupId);
    const studentGroups = await this.prisma.studentGroup.findMany({
      where: { groupId, status: "ACTIVE" },
      include: { student: true }
    });

    return studentGroups.map((sg) => ({
      id: sg.id,
      studentId: sg.student.id,
      fullName: sg.student.fullName,
      phone: sg.student.phone,
      avatarId: sg.student.avatarId,
      status: sg.status,
      joinedAt: sg.joinedAt,
      price: sg.price ?? group.monthlyPrice,
      isCustomPrice: sg.price !== null
    }));
  }

  async updateStudentPrice(groupId: string, studentId: string, dto: UpdateStudentPriceDto) {
    await this.findOne(groupId);
    const studentGroup = await this.prisma.studentGroup.findUnique({
      where: { studentId_groupId: { studentId, groupId } }
    });
    if (!studentGroup) throw new NotFoundException("Student not found in this group");

    await this.prisma.studentGroup.update({
      where: { studentId_groupId: { studentId, groupId } },
      data: { price: dto.price }
    });

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, groupId, status: { not: "CANCELLED" } }
    });
    if (enrollment) {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { price: dto.price }
      });
      await syncOpenChargesForEnrollment(this.prisma, enrollment.id, dto.price);
    }

    return this.getStudents(groupId);
  }

  async resetStudentPrice(groupId: string, studentId: string) {
    const group = await this.findOne(groupId);
    const studentGroup = await this.prisma.studentGroup.findUnique({
      where: { studentId_groupId: { studentId, groupId } }
    });
    if (!studentGroup) throw new NotFoundException("Student not found in this group");

    await this.prisma.studentGroup.update({
      where: { studentId_groupId: { studentId, groupId } },
      data: { price: null }
    });

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, groupId, status: { not: "CANCELLED" } }
    });
    if (enrollment) {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { price: group.monthlyPrice }
      });
      await syncOpenChargesForEnrollment(this.prisma, enrollment.id, group.monthlyPrice);
    }

    return this.getStudents(groupId);
  }

  async syncPricesToAll(groupId: string) {
    const group = await this.findOne(groupId);
    await this.prisma.studentGroup.updateMany({
      where: { groupId, status: "ACTIVE" },
      data: { price: null }
    });
    await this.propagateGroupPriceToEnrollments(groupId, group.monthlyPrice, false);
    return this.getStudents(groupId);
  }
}
