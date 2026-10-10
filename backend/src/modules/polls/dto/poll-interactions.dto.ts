import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsUUID, Length } from "class-validator";
import { PollReasonCode } from "../../../generated/prisma/enums.js";
import { PollAuthorDto, PollResponseDto } from "./polls-response.dto.js";

const lowerCase = ({ value }: { value: unknown }) => typeof value === "string" ? value.toLowerCase() : value;

export class CommentIdParamsDto {
  @ApiProperty({ format: "uuid" })
  @Transform(lowerCase)
  @IsUUID()
  id!: string;
}

export class UserPollsParamsDto {
  @ApiProperty({ format: "uuid", description: "Paylaşımları listelenecek kullanıcı." })
  @Transform(lowerCase)
  @IsUUID()
  id!: string;
}

export class PollCardDto extends PollResponseDto {
  @ApiProperty({ minimum: 0, description: "Toplam tercih sayısı; seçenek sonuçları sonuç ucundan okunur." })
  totalVotes!: number;

  @ApiProperty({ minimum: 0, description: "Aktif ve engelsiz kullanıcıların görünür yorumları." })
  commentCount!: number;

  @ApiProperty({ description: "İzleyicinin kişisel kayıt durumu." })
  isSaved!: boolean;
}

export class PollCardListDto {
  @ApiProperty({ type: [PollCardDto] }) items!: PollCardDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class SavedPollDto extends PollCardDto {
  @ApiProperty({ type: String, format: "date-time" }) savedAt!: Date;
}

export class SavedPollListDto {
  @ApiProperty({ type: [SavedPollDto] }) items!: SavedPollDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class SaveReceiptDto {
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty() isSaved!: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) savedAt!: Date | null;
}

export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 1000, description: "Baştaki/sondaki boşluk kırpılır." })
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 1000)
  body!: string;
}

export class CommentReceiptDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
}

export class CommentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: PollAuthorDto }) author!: PollAuthorDto;
  @ApiProperty() isMine!: boolean;
  @ApiProperty({ description: "Yorumu yazan veya paylaşım sahibi kaldırabilir." }) canRemove!: boolean;
}

export class CommentListDto {
  @ApiProperty({ type: [CommentDto] }) items!: CommentDto[];
  @ApiProperty({ description: "Paylaşım sahibi yeni yorum kabul ediyor mu?" }) commentsEnabled!: boolean;
  @ApiProperty({ description: "Arayüz ipucu: yorumlar açık ve izleyici oy vermiş ya da paylaşım sahibi." }) canComment!: boolean;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class CommentRemovedDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: [true] }) removed!: true;
}

export class SetPollReasonDto {
  @ApiProperty({ enum: PollReasonCode })
  @IsEnum(PollReasonCode)
  reason!: PollReasonCode;
}

export class PollReasonReceiptDto {
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true, description: "İzleyicinin değişmez tercihi." }) optionId!: string | null;
  @ApiProperty({ enum: PollReasonCode, nullable: true }) reason!: PollReasonCode | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) updatedAt!: Date | null;
}

export class PollReasonCountDto {
  @ApiProperty({ enum: PollReasonCode }) code!: PollReasonCode;
  @ApiProperty({ minimum: 0 }) count!: number;
}

export class PollOptionReasonsDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() position!: number;
  @ApiProperty() label!: string;
  @ApiProperty({ type: [PollReasonCountDto], description: "Bütün kodlar sabit sırayla; işaretlenmemiş olan 0." }) reasons!: PollReasonCountDto[];
}

export class PollReasonsDto {
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ enum: PollReasonCode, nullable: true }) myReason!: PollReasonCode | null;
  @ApiProperty({ type: [PollOptionReasonsDto] }) options!: PollOptionReasonsDto[];
}
