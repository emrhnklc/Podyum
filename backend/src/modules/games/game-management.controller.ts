import {
  ManagedGameThemeDto,
  ManagedGameThemeListDto,
  DailyGameScheduleDto,
} from "./dto/game-management-response.dto.js";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin-access.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { GameIdDto } from "./dto/games.dto.js";
import {
  GameScheduleUpdateDto,
  GameThemeCreateDto,
  GameThemeUpdateDto,
} from "./dto/game-management.dto.js";
import { GameManagementService } from "./game-management.service.js";
@ApiTags("Game management")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin/games")
export class GameManagementController {
  constructor(private readonly service: GameManagementService) {}
  @ApiOkResponse({ type: ManagedGameThemeListDto })
  @Get("themes")
  @ApiOperation({ summary: "Tema tanımları ve sürümleri" })
  themes() {
    return this.service.themes();
  }
  @ApiCreatedResponse({ type: ManagedGameThemeDto })
  @Post("themes")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: GameThemeCreateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.createTheme(actor.userId, dto, key);
  }
  @ApiOkResponse({ type: ManagedGameThemeDto })
  @Put("themes/:id")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: GameIdDto,
    @Body() dto: GameThemeUpdateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.updateTheme(actor.userId, params.id, dto, key);
  }
  @ApiOkResponse({ type: DailyGameScheduleDto })
  @Get("daily-schedule")
  schedule() {
    return this.service.schedule();
  }
  @ApiOkResponse({ type: DailyGameScheduleDto })
  @Put("daily-schedule")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({
    summary:
      "Henüz oluşturulmamış günlük etkinlikler için takvim; mevcut etkinliğin snapshot'ını değiştirmez",
  })
  scheduleUpdate(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: GameScheduleUpdateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.updateSchedule(actor.userId, dto, key);
  }
}
