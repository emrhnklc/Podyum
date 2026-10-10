import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ApiError } from "../../common/errors/api-error.js";
import type { ApiRequest } from "../../common/http/request-context.js";
import { PrismaService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

@Injectable()
export class AdminAccessService {
  async require(tx: Prisma.TransactionClient, userId: string) {
    if (!await tx.user.count({ where: { id: userId, role: "ADMIN", status: "ACTIVE" } })) {
      throw new ApiError(403, "ADMIN_REQUIRED", "Bu işlem yönetici yetkisi gerektirir.");
    }
  }

  async lockActors(tx: Prisma.TransactionClient, actorId: string, otherId?: string) {
    // Domain satırı önce kilitlenir; poll/game → user sırasını korur.
    for (const id of [...new Set([actorId, ...(otherId ? [otherId] : [])])].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id}::uuid FOR UPDATE`;
    }
    await this.require(tx, actorId);
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly db: PrismaService, private readonly admin: AdminAccessService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!request.user) throw new ApiError(401, "AUTH_REQUIRED", "Geçerli bir oturum gerekli.");
    await this.admin.require(this.db, request.user.userId);
    return true;
  }
}
