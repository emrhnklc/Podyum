import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import {
  CreateGameDto, DailyGameDto, GameBallotDto, GameHistoryDto, GameIdDto, GameInviteDto,
  GameInviteResponseDto, GameLeaveDto, GamePageDto, GameResultsDto, GameScoreDto, GameScoreParamsDto,
  GameScoreReceiptDto, GameStateDto, GameTurnDto, LeagueDto, OpenGameDto, GameSubmissionReceiptDto, GameSubmitDto, GameSummaryDto, GameVersionDto, UpdateGameSettingsDto,
} from "./dto/games.dto.js";
import { GameSchedulerService } from "./game-scheduler.service.js";
import { GamesService } from "./games.service.js";
import { EmptyGameBodyPipe } from "./dto/empty-game-body.pipe.js";

const Idempotent = () => ApiHeader({ name: "Idempotency-Key", required: true, description: "8–100 karakter; aynı komut/gövde tekrarında aynı anahtar; 24 saat." });

@ApiTags("games")
@ApiBearerAuth()
@Controller()
export class GamesController {
  constructor(private readonly games: GamesService, private readonly scheduler: GameSchedulerService) {}

  @Get("games/daily")
  @ApiOkResponse({ type: DailyGameDto })
  @ApiOperation({ summary: "Yapılandırılan günlük 30+30 etkinlik; saat/tema ayarı yoksa event null" })
  daily() { return this.scheduler.current(); }

  @Post("games/lobbies")
  @Idempotent()
  @ApiCreatedResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Özel lobi oluştur; host otomatik katılır, fotoğraf/oy süreleri ayrı" })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGameDto, @Headers("idempotency-key") key?: string) {
    return this.games.create(user.userId, body, key);
  }

  @Post("games/invites/preview")
  @HttpCode(200)
  @ApiOkResponse({ type: GameSummaryDto })
  @ApiOperation({ summary: "QR davetini doğrula ve lobi özetini göster; otomatik katılım sağlamaz" })
  preview(@CurrentUser() user: AuthenticatedUser, @Body() body: GameInviteDto) { return this.games.previewInvite(user.userId, body.token); }

  @Post("games/join")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "QR davetiyle özel lobiye katıl; önceden arkadaş olma koşulu yok" })
  join(@CurrentUser() user: AuthenticatedUser, @Body() body: GameInviteDto, @Headers("idempotency-key") key?: string) {
    return this.games.joinPrivate(user.userId, body.token, key);
  }

  @Post("games/:id/join")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Günlük etkinliğe veya herkese açık lobiye davetsiz katıl; fotoğraf süresi bitince yeni katılım kapanır" })
  joinDaily(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body(new EmptyGameBodyPipe()) _body: unknown, @Headers("idempotency-key") key?: string) {
    return this.games.joinDaily(user.userId, params.id, key);
  }

  @Get("games/open")
  @ApiOkResponse({ type: [OpenGameDto] })
  @ApiOperation({ summary: "Hızlı eşleş: davet gerekmeden katılınabilir herkese açık lobiler (en fazla 20)" })
  open(@CurrentUser() user: AuthenticatedUser) { return this.games.openRooms(user.userId); }

  @Get("me/league")
  @ApiOkResponse({ type: LeagueDto })
  @ApiOperation({ summary: "Herkese açık defilelerden kazanılan toplam lig puanı ve lig kademesi" })
  league(@CurrentUser() user: AuthenticatedUser) { return this.games.league(user.userId); }

  @Get("me/games")
  @ApiOkResponse({ type: GameHistoryDto })
  @ApiOperation({ summary: "Kendi oyun katılım/geçmiş listen; joinedAt/sessionId cursor" })
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: GamePageDto) { return this.games.history(user.userId, query); }

  @Get("games/:id/turn")
  @ApiOkResponse({ type: GameTurnDto })
  @ApiOperation({ summary: "Podyum Turu: o an herkese gösterilen yarışmacı, tur bitişi, kaç kişinin oyladığı ve sıradaki" })
  turn(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto) { return this.games.turn(user.userId, params.id); }

  @Get("games/:id")
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Üyenin yetkili state'i; DB zamanı, sürüm, süre ve kendi teslim/oy sayısı. Yeniden bağlanınca tekrar okunur." })
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto) { return this.games.get(user.userId, params.id); }

  @Put("games/:id/settings")
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Host başlamamış lobinin ayarlarını tam listeyle değiştirir; expectedVersion" })
  settings(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: UpdateGameSettingsDto, @Headers("idempotency-key") key?: string) {
    const { expectedVersion, ...settings } = body;
    return this.games.settings(user.userId, params.id, settings, expectedVersion, key);
  }

  @Post("games/:id/invite")
  @HttpCode(200)
  @ApiOkResponse({ type: GameInviteResponseDto })
  @ApiOperation({ summary: "Host QR davetini üretir/yeniler; eski token iptal. Ham token yalnız bu yanıtta, idempotency makbuzunda saklanmaz." })
  invite(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: GameVersionDto) {
    return this.games.rotateInvite(user.userId, params.id, body.expectedVersion);
  }

  @Post("games/:id/invite/revoke")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: GameVersionDto, @Headers("idempotency-key") key?: string) {
    return this.games.revokeInvite(user.userId, params.id, body.expectedVersion, key);
  }

  @Post("games/:id/start")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Host en az 2 üyeli lobinin fotoğraf aşamasını başlatır; takvim günlük oyunda sabittir" })
  start(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: GameVersionDto, @Headers("idempotency-key") key?: string) {
    return this.games.start(user.userId, params.id, body.expectedVersion, key);
  }

  @Post("games/:id/end-submission")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameStateDto })
  @ApiOperation({ summary: "Host fotoğraf aşamasını erken kapatır; en az 2 teslim varsa seçilen oy süresi şimdi başlar, yoksa gerekçeli iptal" })
  endSubmission(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: GameVersionDto, @Headers("idempotency-key") key?: string) {
    return this.games.endSubmission(user.userId, params.id, body.expectedVersion, key);
  }

  @Post("games/:id/leave")
  @HttpCode(200)
  @Idempotent()
  @ApiOkResponse({ type: GameLeaveDto })
  leave(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body(new EmptyGameBodyPipe()) _body: unknown, @Headers("idempotency-key") key?: string) {
    return this.games.leave(user.userId, params.id, key);
  }

  @Put("games/:id/submission")
  @ApiOkResponse({ type: GameSubmissionReceiptDto })
  @ApiOperation({ summary: "Kendi onaylı GAME fotoğrafını teslim et/değiştir; süre bitince değişmez. Aynı teslim doğal tekrar makbuzu." })
  submit(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Body() body: GameSubmitDto) { return this.games.submit(user.userId, params.id, body.mediaId); }

  @Get("games/:id/ballot")
  @ApiOkResponse({ type: GameBallotDto })
  @ApiOperation({ summary: "Üyenin henüz değerlendirmediği anonim fotoğraflar; kendine oy yok; kişiye göre döndürülen sıra/cursor" })
  ballot(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Query() query: GamePageDto) { return this.games.ballot(user.userId, params.id, query); }

  @Put("games/:id/submissions/:submissionId/rating")
  @ApiOkResponse({ type: GameScoreReceiptDto })
  @ApiOperation({ summary: "Etkinlik üyeleri 1–5 yıldız verir; fotoğraf göndermek zorunlu değil. Tek değişmez değerlendirme; aynı tekrar aynı makbuz." })
  score(@CurrentUser() user: AuthenticatedUser, @Param() params: GameScoreParamsDto, @Body() body: GameScoreDto) {
    return this.games.score(user.userId, params.id, params.submissionId, body.stars);
  }

  @Get("games/:id/results")
  @ApiOkResponse({ type: GameResultsDto })
  @ApiOperation({ summary: "Kapanış sonrası üyelere sayfalı sonuç ve yazar; oy sayısı/ortalama, sıfır oyda null, profil ödülü yok" })
  results(@CurrentUser() user: AuthenticatedUser, @Param() params: GameIdDto, @Query() query: GamePageDto) { return this.games.results(user.userId, params.id, query); }
}
