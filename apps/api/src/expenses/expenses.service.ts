import { Injectable, NotFoundException } from "@nestjs/common";
import { ExpenseCategory, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto, UpdateExpenseDto } from "./expenses.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(from?: string, to?: string) {
    const where: Prisma.ExpenseWhereInput = {};
    if (from || to) {
      where.spentAt = {};
      if (from) where.spentAt.gte = new Date(from);
      if (to) where.spentAt.lte = new Date(to);
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }]
    });
  }

  async create(recordedById: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        title: dto.title.trim(),
        category: dto.category,
        amount: dto.amount,
        spentAt: new Date(dto.spentAt),
        comment: dto.comment?.trim() || null,
        recordedById
      }
    });
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.spentAt !== undefined) data.spentAt = new Date(dto.spentAt);
    if (dto.comment !== undefined) data.comment = dto.comment.trim() || null;

    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }

  async totalByCategory(from?: string, to?: string) {
    const where: Prisma.ExpenseWhereInput = {};
    if (from || to) {
      where.spentAt = {};
      if (from) where.spentAt.gte = new Date(from);
      if (to) where.spentAt.lte = new Date(to);
    }

    const rows = await this.prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true }
    });

    const byCategory = Object.values(ExpenseCategory).reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    let total = 0;
    for (const row of rows) {
      const sum = row._sum.amount ?? 0;
      byCategory[row.category] = sum;
      total += sum;
    }

    return { total, byCategory };
  }
}
