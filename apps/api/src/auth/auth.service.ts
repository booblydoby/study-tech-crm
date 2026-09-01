import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RoleName } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { role: true }
    });
    if (!user?.isActive || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.cleanupRefreshTokens(user.id);
    return this.issueTokens(user.id, user.email, user.role.name);
  }

  async refresh(refreshToken: string) {
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { role: true } } }
    });

    if (!existing?.user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });
    return this.issueTokens(existing.user.id, existing.user.email, existing.user.role.name);
  }

  async logout(refreshToken: string) {
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null }
    });
    if (existing) {
      await this.prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, role: RoleName) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m"
      }
    );
    const refreshToken = randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(this.config.get<number>("JWT_REFRESH_TTL_DAYS") ?? 30));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt
      }
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async cleanupRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
      }
    });
  }
}
