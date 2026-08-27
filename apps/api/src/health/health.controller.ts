import { Controller, Get, Version } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  @Version("1")
  liveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @Version("1")
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready", timestamp: new Date().toISOString() };
  }
}
