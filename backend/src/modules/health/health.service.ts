import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch {
      throw new ServiceUnavailableException("Veritabanı bağlantısı hazır değil.");
    }
  }
}
