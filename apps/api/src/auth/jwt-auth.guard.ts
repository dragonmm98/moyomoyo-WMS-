import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./auth.types";
import { IS_PUBLIC_KEY } from "./public.decorator";

type AuthedRequest = Request & {
  user?: AuthUser;
  cookies?: Record<string, string>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.readAccessToken(request);
    if (!token) {
      throw new UnauthorizedException("Sign in required.");
    }
    request.user = await this.auth.meFromAccessToken(token);
    return true;
  }

  private readAccessToken(request: AuthedRequest) {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7);
    const cookie = request.cookies?.[this.auth.cookieNames.access];
    return typeof cookie === "string" ? cookie : undefined;
  }
}
