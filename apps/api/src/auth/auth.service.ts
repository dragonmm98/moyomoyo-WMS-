import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload, AuthUser } from "./auth.types";

const ACCESS_COOKIE = "wms_access";
const REFRESH_COOKIE = "wms_refresh";
const ACCESS_TTL_SECONDS = 60 * 60 * 8;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 7;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  get cookieNames() {
    return { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user?.active) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    const matches = await compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const refreshToken = randomBytes(32).toString("hex");
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    const authUser = this.toAuthUser(user);
    return {
      user: authUser,
      accessToken: this.signAccessToken(authUser, session.id),
      refreshToken,
      accessMaxAgeMs: ACCESS_TTL_SECONDS * 1000,
      refreshMaxAgeMs: REFRESH_TTL_MS,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    await this.prisma.authSession.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async meFromAccessToken(token: string): Promise<AuthUser> {
    const payload = this.verifyAccessToken(token);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.active
    ) {
      throw new UnauthorizedException("Session expired. Sign in again.");
    }
    return this.toAuthUser(session.user);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return verify(token, this.accessSecret()) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException("Session expired. Sign in again.");
    }
  }

  cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeMs,
    };
  }

  private signAccessToken(user: AuthUser, sessionId: string) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sid: sessionId,
    };
    return sign(payload, this.accessSecret(), { expiresIn: ACCESS_TTL_SECONDS });
  }

  private accessSecret() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("JWT_ACCESS_SECRET must be at least 32 characters.");
    }
    return secret;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "OPERATOR";
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
