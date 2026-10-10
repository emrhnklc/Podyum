import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, ValidateIf } from "class-validator";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";
import { PollCategory } from "../../../generated/prisma/enums.js";
import { PollResponseDto } from "../../polls/dto/polls-response.dto.js";

export enum FeedScope {
  EVERYONE = "everyone",
  FRIENDS = "friends",
}

export class FeedQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: FeedScope, default: FeedScope.EVERYONE })
  @IsEnum(FeedScope)
  scope: FeedScope = FeedScope.EVERYONE;

  @ApiPropertyOptional({ enum: PollCategory, description: "Tümü için category gönderilmez." })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PollCategory)
  category?: PollCategory;
}

export class FeedItemDto extends PollResponseDto {
  @ApiProperty({ minimum: 0, description: "Toplam tercih sayısı; seçenek sonuçları oy öncesi açıklanmaz." })
  totalVotes!: number;

  @ApiProperty({ minimum: 0, description: "Aktif ve engelsiz kullanıcıların görünür yorumları." })
  commentCount!: number;

  @ApiProperty({ description: "İzleyicinin kişisel kayıt durumu; kaydetme komutları henüz uygulanmadı." })
  isSaved!: boolean;
}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedItemDto] }) items!: FeedItemDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
