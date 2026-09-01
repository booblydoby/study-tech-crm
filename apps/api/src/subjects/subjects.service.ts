import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubjectDto, UpdateSubjectDto } from "./subjects.dto";

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() { return this.prisma.subject.findMany({ orderBy: { name: "asc" } }); }
  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id }, include: { groups: true } });
    if (!subject) throw new NotFoundException("Subject not found");
    return subject;
  }
  create(dto: CreateSubjectDto) { return this.prisma.subject.create({ data: dto }); }
  async update(id: string, dto: UpdateSubjectDto) { await this.findOne(id); return this.prisma.subject.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.subject.update({ where: { id }, data: { isActive: false } }); }
}
