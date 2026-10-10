import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsISO8601, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from "class-validator";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";
import { GameMemberStatus, GamePhase, GameSessionKind } from "../../../generated/prisma/enums.js";

export class GameIdDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  id!: string;
}

export class GameScoreParamsDto extends GameIdDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  submissionId!: string;
}

export class CreateGameDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 120)
  themeTitle!: string;

  @ApiPropertyOptional({ minimum: 60, maximum: 7200, default: 1800 })
  @IsInt() @Min(60) @Max(7200)
  submissionSeconds: number = 1800;

  @ApiPropertyOptional({ minimum: 60, maximum: 7200, default: 1800 })
  @IsInt() @Min(60) @Max(7200)
  votingSeconds: number = 1800;

  @ApiPropertyOptional({ minimum: 2, maximum: 50, default: 20 })
  @IsInt() @Min(2) @Max(50)
  maxMembers: number = 20;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true, description: "Planlı başlangıç; en erken 1 dakika, en geç 24 saat sonrası. Bu anda en az iki üye varsa oda kendiliğinden başlar, yoksa NOT_ENOUGH_PLAYERS ile iptal olur. Boşsa host başlatır." })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  startsAt: string | null = null;

  @ApiPropertyOptional({ default: false, description: "true: davet gerekmeden Hızlı eşleş'te bulunur ve katılınır. false: yalnız QR davetiyle." })
  @IsBoolean()
  isPublic: boolean = false;
}

export class GameVersionDto {
  @ApiProperty({ minimum: 0, maximum: 2147483646 })
  @IsInt() @Min(0) @Max(2147483646)
  expectedVersion!: number;
}

export class UpdateGameSettingsDto extends CreateGameDto {
  @ApiProperty({ minimum: 0, maximum: 2147483646 })
  @IsInt() @Min(0) @Max(2147483646)
  expectedVersion!: number;
}

export class GameInviteDto {
  @ApiProperty({ description: "QR/deep-link içindeki 43 karakterlik davet. URL yerine body ile gönderilir." })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}

export class GameSubmitDto {
  @ApiProperty({ format: "uuid", description: "Kendine ait, GAME amaçlı, READY ve önizlemesi onaylı fotoğraf." })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  mediaId!: string;
}

export class GameScoreDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5)
  stars!: number;
}

export class GamePageDto extends PageQueryDto {}

export class GameSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: GameSessionKind }) kind!: GameSessionKind;
  @ApiProperty({ enum: GamePhase }) phase!: GamePhase;
  @ApiProperty() themeTitle!: string;
  @ApiProperty() rulesVersion!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) hostId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) maxMembers!: number | null;
  @ApiProperty() isPublic!: boolean;
  @ApiProperty() submissionSeconds!: number;
  @ApiProperty() votingSeconds!: number;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) startsAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) submissionEndsAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) votingStartsAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) votingEndsAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) waitingExpiresAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) finishedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) cancelReason!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) phaseEndsAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty() remainingSeconds!: number;
}

export class OwnGameSubmissionDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) mediaId!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, format: "date-time" }) submittedAt!: Date;
}

export class OpenGameDto extends GameSummaryDto {
  @ApiProperty() memberCount!: number;
}

export class GameStateDto extends GameSummaryDto {
  @ApiProperty({ enum: GameMemberStatus }) membershipStatus!: GameMemberStatus;
  @ApiProperty() memberCount!: number;
  @ApiProperty() submissionCount!: number;
  @ApiProperty() myRatingCount!: number;
  @ApiProperty() isHost!: boolean;
  @ApiProperty() canSubmit!: boolean;
  @ApiProperty() canVote!: boolean;
  @ApiProperty() canEndSubmission!: boolean;
  @ApiProperty({ type: OwnGameSubmissionDto, nullable: true }) mySubmission!: OwnGameSubmissionDto | null;
}

export class GameInviteResponseDto {
  @ApiProperty({ format: "uuid" }) sessionId!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ description: "Yalnız bu yanıtta açılır; veritabanında hash saklanır." }) token!: string;
  @ApiProperty() deepLink!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
}

export class DailyGameDto {
  @ApiProperty({ description: "Günlük saat, saat dilimi ve tema ayarları birlikte girildi mi?" }) scheduleConfigured!: boolean;
  @ApiProperty({ type: GameSummaryDto, nullable: true }) event!: GameSummaryDto | null;
}

export class GameSubmissionReceiptDto {
  @ApiProperty({ format: "uuid" }) sessionId!: string;
  @ApiProperty({ format: "uuid" }) submissionId!: string;
  @ApiProperty({ format: "uuid" }) mediaId!: string;
  @ApiProperty({ type: String, format: "date-time" }) acceptedAt!: Date;
}

export class GameScoreReceiptDto {
  @ApiProperty({ format: "uuid" }) sessionId!: string;
  @ApiProperty({ format: "uuid" }) submissionId!: string;
  @ApiProperty() stars!: number;
  @ApiProperty({ type: String, format: "date-time" }) acceptedAt!: Date;
}

export class GameBallotItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ description: "Sabit yarışmacı numarası; kullanıcı kimliği değildir." }) number!: number;
  @ApiProperty({ format: "uuid" }) mediaId!: string;
  @ApiProperty() displayPath!: string;
  @ApiProperty() thumbnailPath!: string;
}

export class GameBallotDto {
  @ApiProperty({ type: [GameBallotItemDto] }) items!: GameBallotItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, format: "date-time" }) votingEndsAt!: Date;
}

export class GameTurnEntryDto extends GameBallotItemDto {
  @ApiProperty({ description: "Gösterilen kombin isteyen kullanıcınınsa true; kendine oy veremez." }) mine!: boolean;
  @ApiProperty({ type: Number, nullable: true }) myStars!: number | null;
}

export class GameTurnDto {
  @ApiProperty() index!: number;
  @ApiProperty() total!: number;
  @ApiProperty() turnSeconds!: number;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, format: "date-time" }) turnEndsAt!: Date;
  @ApiProperty({ type: GameTurnEntryDto, nullable: true, description: "Engelli yazarın kombininde null." }) current!: GameTurnEntryDto | null;
  @ApiProperty() votedCount!: number;
  @ApiProperty({ description: "Gösterilen kombine oy verebilecek aktif üye sayısı (yazar hariç)." }) voterCount!: number;
  @ApiProperty({ type: Number, nullable: true, description: "Kendi kombinine kaç tur kaldı; geçtiyse veya yoksa null." }) myTurnIn!: number | null;
  @ApiProperty({ type: Number, nullable: true }) nextNumber!: number | null;
}

export class GameResultAuthorDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) avatarPath!: string | null;
}

export class LeagueInfoDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) nextName!: string | null;
  @ApiProperty() current!: number;
  @ApiProperty({ type: Number, nullable: true }) span!: number | null;
  @ApiProperty({ type: Number, nullable: true }) remaining!: number | null;
}

export class LeagueDto {
  @ApiProperty() totalPoints!: number;
  @ApiProperty({ type: LeagueInfoDto }) league!: LeagueInfoDto;
}

export class GameResultItemDto extends GameBallotItemDto {
  @ApiProperty({ type: GameResultAuthorDto }) author!: GameResultAuthorDto;
  @ApiProperty({ description: "Ortalama yıldız, oy sayısı, yükleme sırası ile 1'den başlayan sıra." }) rank!: number;
  @ApiProperty({ description: "Bu kombinin kazandığı lig puanı; davetli odada 0." }) awardedPoints!: number;
  @ApiProperty() ratingCount!: number;
  @ApiProperty() ratingSum!: number;
  @ApiProperty({ type: Number, nullable: true }) averageStars!: number | null;
}

export class GameResultsDto extends GameSummaryDto {
  @ApiProperty({ type: [GameResultItemDto] }) items!: GameResultItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ description: "true: herkese açık defile; ilk üçe lig puanı verilir. false: davetli oda, yalnız sıralama." }) official!: boolean;
  @ApiProperty({ description: "İsteyen kullanıcının bu defileden kazandığı lig puanı." }) awardedPoints!: number;
  @ApiProperty({ type: Number, nullable: true }) myRank!: number | null;
  @ApiProperty({ type: Number, nullable: true, description: "Davetli odada null." }) totalPoints!: number | null;
  @ApiProperty({ type: LeagueInfoDto, nullable: true }) league!: LeagueInfoDto | null;
}

export class GameHistoryItemDto extends GameSummaryDto {
  @ApiProperty({ enum: GameMemberStatus }) membershipStatus!: GameMemberStatus;
}

export class GameHistoryDto {
  @ApiProperty({ type: [GameHistoryItemDto] }) items!: GameHistoryItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
}

export class GameLeaveDto {
  @ApiProperty({ format: "uuid" }) sessionId!: string;
  @ApiProperty({ enum: [true] }) left!: true;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: GamePhase }) phase!: GamePhase;
}
