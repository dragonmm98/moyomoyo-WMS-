import { Body, Controller, Get, HttpCode, Post, Req, Res, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";
import type { AuthUser } from "./auth.types";

type CookieRequest = Request & { cookies?: Record<string, string> };

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @Version("1")
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(input.email, input.password);
    this.writeCookies(response, session.accessToken, session.refreshToken, session.accessMaxAgeMs, session.refreshMaxAgeMs);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Public()
  @Post("logout")
  @Version("1")
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.cookies?.[this.auth.cookieNames.refresh]);
    response.clearCookie(this.auth.cookieNames.access, { path: "/" });
    response.clearCookie(this.auth.cookieNames.refresh, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @Version("1")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private writeCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    accessMaxAgeMs: number,
    refreshMaxAgeMs: number,
  ) {
    response.cookie(
      this.auth.cookieNames.access,
      accessToken,
      this.auth.cookieOptions(accessMaxAgeMs),
    );
    response.cookie(
      this.auth.cookieNames.refresh,
      refreshToken,
      this.auth.cookieOptions(refreshMaxAgeMs),
    );
  }
}
