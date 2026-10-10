import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { CreatePollDto, DeleteDraftQueryDto, MyPollsQueryDto, PollIdParamsDto, PollVersionDto, UpdateCommentSettingsDto, UpdatePollDto } from "./dto/polls.dto.js";
import { DeleteDraftResponseDto, MyPollsResponseDto, PollResponseDto } from "./dto/polls-response.dto.js";
import { PollsService } from "./polls.service.js";

const Idempotent = () => ApiHeader({ name: "Idempotency-Key", required: true, description: "8–100 karakter. Aynı komutun tekrarında aynı anahtar ve gövde; 24 saat saklanır." });

@ApiTags("polls")
@ApiBearerAuth()
@Controller()
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Post("polls")
  @Idempotent()
  @ApiCreatedResponse({ type: PollResponseDto })
  @ApiOperation({ summary: "Eksik bilgiyle de kaydedilebilen kişisel taslak oluştur" })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePollDto, @Headers("idempotency-key") key?: string) {
    return this.polls.create(user.userId, body, key);
  }

  @Patch("polls/:id")
  @Idempotent()
  @ApiOkResponse({ type: PollResponseDto })
  @ApiOperation({ summary: "Kendi taslağını expectedVersion ile düzenle; options gönderilirse tüm liste değişir" })
  update(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: UpdatePollDto, @Headers("idempotency-key") key?: string) {
    return this.polls.update(user.userId, params.id, body, key);
  }

  @Post("polls/:id/publish")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: PollResponseDto })
  @ApiOperation({ summary: "Soru ve 2–4 onaylı görselle atomik yayınla; süre sunucuda başlar" })
  publish(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: PollVersionDto, @Headers("idempotency-key") key?: string) {
    return this.polls.publish(user.userId, params.id, body.expectedVersion, key);
  }

  @Post("polls/:id/cancel")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: PollResponseDto })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: PollVersionDto, @Headers("idempotency-key") key?: string) {
    return this.polls.cancel(user.userId, params.id, body.expectedVersion, key);
  }

  @Delete("polls/:id")
  @Idempotent()
  @ApiOkResponse({ type: DeleteDraftResponseDto })
  @ApiOperation({ summary: "Kendi taslağını sil; expectedVersion query'de, medya dosyası ayrıca yönetilir" })
  delete(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Query() query: DeleteDraftQueryDto, @Headers("idempotency-key") key?: string) {
    return this.polls.deleteDraft(user.userId, params.id, query.expectedVersion, key);
  }

  @Patch("polls/:id/comment-settings")
  @Idempotent()
  @ApiOkResponse({ type: PollResponseDto })
  @ApiOperation({ summary: "Yayın sonrası yalnız yorum kabul ayarını değiştir; yorum API'si sonraki adımda" })
  comments(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: UpdateCommentSettingsDto, @Headers("idempotency-key") key?: string) {
    return this.polls.updateCommentSettings(user.userId, params.id, body, key);
  }

  @Get("polls/:id")
  @ApiOkResponse({ type: PollResponseDto })
  @ApiOperation({ summary: "Kendi taslağın/iptalin veya erişebildiğin yayınlanmış oylama; sonuç/oy API'si henüz yok" })
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto) { return this.polls.get(user.userId, params.id); }

  @Get("me/polls")
  @ApiOkResponse({ type: MyPollsResponseDto })
  @ApiOperation({ summary: "Kendi taslak/yayın/iptallerini createdAt ve id cursor'ıyla listele" })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: MyPollsQueryDto) { return this.polls.listMine(user.userId, query); }
}
