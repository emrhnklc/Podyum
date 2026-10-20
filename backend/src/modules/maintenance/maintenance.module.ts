import { MaintenanceStatusDto } from "./maintenance-response.dto.js";
import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { DatabaseModule } from "../../database/database.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AdminGuard } from "../auth/admin-access.service.js";
import { MediaModule } from "../media/media.module.js";
import { MaintenanceService } from "./maintenance.service.js";
import { MaintenanceWorker } from "./maintenance.worker.js";
@ApiTags("Maintenance")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin/maintenance")
class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}
  @Get()
  @ApiOkResponse({
    type: MaintenanceStatusDto,
    description:
      "Son bakımın sansürlenmiş sayıları, başarı/hata ve zamanları; token, dosya adı veya dizin içermez.",
  })
  @ApiOperation({
    summary: "Son teknik bakım durumunu oku; çalıştırma komutu yerel CLI'dadır",
  })
  status() {
    return this.service.status();
  }
}
@Module({
  imports: [DatabaseModule, AuthModule, MediaModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceWorker],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
