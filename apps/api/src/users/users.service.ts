import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import * as argon2 from "argon2";
import { publicUserSelect } from "../common/prisma/user.select";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./users.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async create(dto: CreateUserDto) {
    const role = await this.ensureRole(dto.role);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash: await argon2.hash(dto.password),
          fullName: dto.fullName,
          roleId: role.id
        },
        select: publicUserSelect
      });
    } catch {
      throw new ConflictException("User with this email already exists");
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const role = dto.role ? await this.ensureRole(dto.role) : null;
    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        isActive: dto.isActive,
        roleId: role?.id,
        passwordHash: dto.password ? await argon2.hash(dto.password) : undefined
      },
      select: publicUserSelect
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: publicUserSelect
    });
  }

  private ensureRole(name: RoleName) {
    return this.prisma.role.upsert({
      where: { name },
      create: { name },
      update: {}
    });
  }
}
