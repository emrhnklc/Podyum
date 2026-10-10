import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { AdminGuard } from "../auth/admin-access.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { MediaContentQueryDto } from "../media/dto/media.dto.js";
import { AdminService } from "./admin.service.js";
import { AdminActionReceiptDto, AdminAuditPageDto, AdminAuditQueryDto, AdminIdDto, AdminMeDto, AdminPollVisibilityDto, AdminReasonDto, AdminReportDetailDto, AdminReportMediaDto, AdminReportReceiptDto, AdminReportsPageDto, AdminReportsQueryDto, AdminUserStatusDto, AdminVersionDto, ReviewReportDto } from "./dto/admin.dto.js";

const idempotency = () => ApiHeader({ name: "Idempotency-Key", required: true, description: "8–100 karakter; 24 saat aynı istek aynı makbuzu döndürür." });

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("me") @ApiOkResponse({ type: AdminMeDto })
  me(@CurrentUser() user: AuthenticatedUser) { return this.admin.me(user.userId); }

  @Get("reports") @ApiOkResponse({ type: AdminReportsPageDto }) @ApiOperation({ summary: "Yönetici şikâyet kuyruğu; varsayılan OPEN, filtreye bağlı cursor" })
  reports(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminReportsQueryDto) { return this.admin.reports(user.userId, query); }

  @Get("reports/:id") @ApiOkResponse({ type: AdminReportDetailDto }) @ApiOperation({ summary: "Şikâyet metni ve hedef içerik; özel profil/e-posta/oturum bilgisi içermez" })
  report(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto) { return this.admin.report(user.userId, params.id); }

  @Get("reports/:id/media/:mediaId/content") @ApiProduces("image/webp")
  @ApiOkResponse({ schema: { type: "string", format: "binary" } })
  @ApiOperation({ summary: "Yalnız şikâyetin bağlı olduğu işlenmiş ve onaylı görsel; orijinal dosyayı açmaz" })
  async preview(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminReportMediaDto, @Query() query: MediaContentQueryDto) {
    const buffer = await this.admin.preview(user.userId, params.id, params.mediaId, query.variant ?? "display");
    return new StreamableFile(buffer, { type: "image/webp", disposition: "inline", length: buffer.length });
  }

  @Put("reports/:id/decision") @idempotency() @ApiOkResponse({ type: AdminReportReceiptDto })
  @ApiOperation({ summary: "Şikâyet kararı, varsa hedef yaptırımı ve denetim kaydı aynı transaction" })
  review(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto, @Body() dto: ReviewReportDto, @Headers("idempotency-key") key: unknown) {
    return this.admin.review(user.userId, params.id, dto, key);
  }

  @Put("polls/:id/visibility") @idempotency() @ApiOkResponse({ type: AdminActionReceiptDto })
  visibility(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto, @Body() dto: AdminPollVisibilityDto, @Headers("idempotency-key") key: unknown) {
    return this.admin.visibility(user.userId, params.id, dto, key);
  }

  @Post("comments/:id/remove") @HttpCode(200) @idempotency() @ApiOkResponse({ type: AdminActionReceiptDto })
  remove(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto, @Body() dto: AdminReasonDto, @Headers("idempotency-key") key: unknown) {
    return this.admin.comment(user.userId, params.id, dto.reason, key);
  }

  @Put("users/:id/status") @idempotency() @ApiOkResponse({ type: AdminActionReceiptDto })
  status(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto, @Body() dto: AdminUserStatusDto, @Headers("idempotency-key") key: unknown) {
    return this.admin.status(user.userId, params.id, dto, key);
  }

  @Post("games/:id/cancel") @HttpCode(200) @idempotency() @ApiOkResponse({ type: AdminActionReceiptDto })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: AdminIdDto, @Body() dto: AdminVersionDto, @Headers("idempotency-key") key: unknown) {
    return this.admin.cancelGame(user.userId, params.id, dto, key);
  }

  @Get("audit") @ApiOkResponse({ type: AdminAuditPageDto }) @ApiOperation({ summary: "Gerekçeli denetim kayıtları; yazma/silme API'si yok" })
  audit(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminAuditQueryDto) { return this.admin.audits(user.userId, query); }
}
