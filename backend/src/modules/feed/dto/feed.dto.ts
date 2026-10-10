import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, ValidateIf } from "class-validator";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";
import { PollCategory } from "../../../generated/prisma/enums.js";
import { PollCardDto } from "../../polls/dto/poll-interactions.dto.js";

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

// Akış kartı ortak liste kartıdır: totalVotes, commentCount ve isSaved alanlarını taşır.
export class FeedItemDto extends PollCardDto {}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedItemDto] }) items!: FeedItemDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
