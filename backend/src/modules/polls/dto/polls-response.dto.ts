import { ApiProperty } from "@nestjs/swagger";
import { AgeBand, AudienceGender, ContentStatus, MediaStatus, PollCategory, PollStatus, Visibility } from "../../../generated/prisma/enums.js";

export class PollAuthorDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) avatarPath!: string | null;
}

export class PollMediaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: MediaStatus }) status!: MediaStatus;
  @ApiProperty({ type: Number, nullable: true }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true }) height!: number | null;
  @ApiProperty() previewAccepted!: boolean;
  @ApiProperty({ type: String, nullable: true }) displayPath!: string | null;
  @ApiProperty({ type: String, nullable: true }) thumbnailPath!: string | null;
}

export class ProductTagResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ type: Number, nullable: true }) priceMinor!: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty() externalUrl!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true, description: "Fiyat beyanının kayda alındığı zaman; mağazada doğrulanmış fiyat tarihi değildir." }) priceRecordedAt!: Date | null;
  @ApiProperty({ enum: ["USER_ENTERED"] }) source!: "USER_ENTERED";
}

export class PollOptionResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: ["A", "B", "C", "D"] }) label!: string;
  @ApiProperty({ format: "uuid" }) mediaId!: string;
  @ApiProperty({ type: PollMediaDto }) media!: PollMediaDto;
  @ApiProperty({ type: [ProductTagResponseDto] }) products!: ProductTagResponseDto[];
}

export class PollSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ enum: PollCategory }) category!: PollCategory;
  @ApiProperty({ enum: Visibility }) visibility!: Visibility;
  @ApiProperty({ enum: PollStatus, description: "Kalıcı durum; tarama aralığında effectiveStatus daha güncel olabilir." }) status!: PollStatus;
  @ApiProperty({ enum: PollStatus, description: "OPEN süre dolduysa işçi beklenmeden CLOSED görünür." }) effectiveStatus!: PollStatus;
  @ApiProperty({ enum: ContentStatus }) contentStatus!: ContentStatus;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) publishedAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) closesAt!: Date | null;
}

export class PollResponseDto extends PollSummaryDto {
  @ApiProperty({ type: PollAuthorDto }) author!: PollAuthorDto;
  @ApiProperty({ type: String, nullable: true }) occasion!: string | null;
  @ApiProperty({ enum: AudienceGender }) audienceGender!: AudienceGender;
  @ApiProperty({ enum: AgeBand, nullable: true }) audienceAgeBand!: AgeBand | null;
  @ApiProperty() styleMatchRequired!: boolean;
  @ApiProperty() commentsEnabled!: boolean;
  @ApiProperty({ enum: [1800, 7200, 86400] }) durationSeconds!: number;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) closedAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ minimum: 0 }) remainingSeconds!: number;
  @ApiProperty() isOwner!: boolean;
  @ApiProperty() canEditDraft!: boolean;
  @ApiProperty() canCancel!: boolean;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) myOptionId!: string | null;
  @ApiProperty() canVote!: boolean;
  @ApiProperty() canViewResults!: boolean;
  @ApiProperty({ type: [PollOptionResponseDto] }) options!: PollOptionResponseDto[];
}

export class MyPollListItemDto extends PollSummaryDto {
  @ApiProperty() optionCount!: number;
  @ApiProperty({ type: String, nullable: true }) thumbnailPath!: string | null;
}

export class MyPollsResponseDto {
  @ApiProperty({ type: [MyPollListItemDto] }) items!: MyPollListItemDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class DeleteDraftResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: [true] }) deleted!: true;
}
