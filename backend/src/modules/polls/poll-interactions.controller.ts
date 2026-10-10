import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import {
  CommentIdParamsDto, CommentListDto, CommentReceiptDto, CommentRemovedDto, CreateCommentDto, PollCardListDto,
  PollReasonReceiptDto, PollReasonsDto, SavedPollListDto, SaveReceiptDto, SetPollReasonDto, UserPollsParamsDto,
} from "./dto/poll-interactions.dto.js";
import { PollIdParamsDto } from "./dto/polls.dto.js";
import { PollInteractionsService } from "./poll-interactions.service.js";

@ApiTags("poll-interactions")
@ApiBearerAuth()
@Controller()
export class PollInteractionsController {
  constructor(private readonly interactions: PollInteractionsService) {}

  @Put("polls/:id/save")
  @ApiOkResponse({ type: SaveReceiptDto })
  @ApiOperation({ summary: "Görebildiğin yayını kişisel listene kaydet; tekrar aynı kaydı döndürür, erişim hakkı vermez" })
  save(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto) { return this.interactions.save(user.userId, params.id); }

  @Delete("polls/:id/save")
  @ApiOkResponse({ type: SaveReceiptDto })
  @ApiOperation({ summary: "Kaydı kaldır; kayıt yoksa da başarılıdır" })
  unsave(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto) { return this.interactions.unsave(user.userId, params.id); }

  @Get("me/saved-polls")
  @ApiOkResponse({ type: SavedPollListDto })
  @ApiOperation({ summary: "Hâlâ görebildiğin kayıtlı paylaşımlar; savedAt ve id cursor'ı" })
  saved(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) { return this.interactions.listSaved(user.userId, query); }

  @Get("users/:id/polls")
  @ApiOkResponse({ type: PollCardListDto })
  @ApiOperation({ summary: "Bir kullanıcının izleyicinin görebildiği yayınları; publishedAt ve id cursor'ı" })
  userPolls(@CurrentUser() user: AuthenticatedUser, @Param() params: UserPollsParamsDto, @Query() query: PageQueryDto) {
    return this.interactions.listUserPolls(user.userId, params.id, query);
  }

  @Get("polls/:id/comments")
  @ApiOkResponse({ type: CommentListDto })
  @ApiOperation({ summary: "Görünür yorumlar, yeniden eskiye; yorumlar kapalıyken de eski yorumlar okunur" })
  comments(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Query() query: PageQueryDto) {
    return this.interactions.listComments(user.userId, params.id, query);
  }

  @Post("polls/:id/comments")
  @ApiHeader({ name: "Idempotency-Key", required: true, description: "8–100 karakter. Aynı yorumun tekrarında aynı anahtar ve gövde; 24 saat saklanır." })
  @ApiCreatedResponse({ type: CommentReceiptDto })
  @ApiOperation({ summary: "Yalnız oy verenler ve paylaşım sahibi yorum yazar; yorum sonradan düzenlenemez" })
  comment(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: CreateCommentDto, @Headers("idempotency-key") key?: string) {
    return this.interactions.createComment(user.userId, params.id, body.body, key);
  }

  @Delete("comments/:id")
  @ApiOkResponse({ type: CommentRemovedDto })
  @ApiOperation({ summary: "Kendi yorumunu veya kendi paylaşımındaki bir yorumu kaldır; tekrar aynı sonucu döndürür" })
  removeComment(@CurrentUser() user: AuthenticatedUser, @Param() params: CommentIdParamsDto) {
    return this.interactions.removeComment(user.userId, params.id);
  }

  @Put("polls/:id/reason")
  @ApiOkResponse({ type: PollReasonReceiptDto })
  @ApiOperation({ summary: "Oy verdikten sonra seçtiğin kombin için tek hazır neden; değiştirilebilir" })
  setReason(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto, @Body() body: SetPollReasonDto) {
    return this.interactions.setReason(user.userId, params.id, body.reason);
  }

  @Delete("polls/:id/reason")
  @ApiOkResponse({ type: PollReasonReceiptDto })
  @ApiOperation({ summary: "Seçtiğin nedeni kaldır; neden yoksa da başarılıdır" })
  clearReason(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto) { return this.interactions.clearReason(user.userId, params.id); }

  @Get("polls/:id/reasons")
  @ApiOkResponse({ type: PollReasonsDto })
  @ApiOperation({ summary: "Seçenek başına neden sayıları; sonuçla aynı görünürlük kuralı" })
  reasons(@CurrentUser() user: AuthenticatedUser, @Param() params: PollIdParamsDto) { return this.interactions.reasons(user.userId, params.id); }
}
