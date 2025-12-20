import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";
import * as argon2 from "argon2";
import crypto from "crypto";

type SignupInput = {
  email: string;
  password: string;
  displayName?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private defaultDisplayName(email: string) {
    const local = email.split("@")[0] ?? "user";
    return local.slice(0, 60);
  }

  private refreshTokenHash(token: string) {
    // HMAC(sha256, JWT_SECRET, refreshToken) => stable hash without storing plaintext
    return crypto.createHmac("sha256", env().JWT_SECRET).update(token).digest("hex");
  }

  private async issueTokens(userId: string, email: string) {
    const e = env();

    const accessExpiresAt = new Date(Date.now() + e.JWT_ACCESS_TTL_SECONDS * 1000);
    const accessToken = await this.jwt.signAsync(
      { email },
      { subject: userId, expiresIn: e.JWT_ACCESS_TTL_SECONDS },
    );

    const refreshToken = crypto.randomBytes(48).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + e.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.refreshTokenHash(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: accessExpiresAt.toISOString(),
      userId,
    };
  }

  async signup(input: SignupInput) {
    const email = this.normalizeEmail(input.email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({
        error: { code: "EMAIL_IN_USE", message: "Email is already in use" },
      });
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName?.trim() || this.defaultDisplayName(email),
      },
      select: { id: true, email: true },
    });

    return await this.issueTokens(user.id, user.email);
  }

  async login(input: LoginInput) {
    const email = this.normalizeEmail(input.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, isBanned: true },
    });

    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (user.isBanned) throw new UnauthorizedException("Account disabled");

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return await this.issueTokens(user.id, user.email);
  }

  /**
   * Refresh token rotation + reuse detection:
   * - If token not found => unauthorized
   * - If token found but revoked => assume reuse; revoke all active tokens; unauthorized
   * - If expired => revoke it; unauthorized
   * - Else rotate: revoke old, mint new refresh token, return new access+refresh
   */
  async refresh(refreshToken: string) {
    const tokenHash = this.refreshTokenHash(refreshToken);

    const rt = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true, user: { select: { email: true, isBanned: true } } },
    });

    if (!rt) throw new UnauthorizedException("Invalid refresh token");
    if (rt.user.isBanned) throw new UnauthorizedException("Account disabled");

    const now = new Date();

    if (rt.revokedAt) {
      // reuse detection → revoke all active refresh tokens for user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: rt.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (rt.expiresAt <= now) {
      await this.prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: now } });
      throw new UnauthorizedException("Refresh token expired");
    }

    // Rotate
    await this.prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: now } });
    return await this.issueTokens(rt.userId, rt.user.email);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.refreshTokenHash(refreshToken);
    const now = new Date();

    // idempotent logout: if token not found, still return ok
    const rt = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { id: true, revokedAt: true },
    });

    if (rt && !rt.revokedAt) {
      await this.prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: now } });
    }

    return { ok: true as const };
  }
}
