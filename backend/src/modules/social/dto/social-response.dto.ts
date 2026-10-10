import { ApiProperty } from "@nestjs/swagger";
import type { RelationshipState } from "../social-access.service.js";

const states: RelationshipState[] = ["SELF", "NONE", "OUTGOING_REQUEST", "INCOMING_REQUEST", "FRIENDS"];

export class SocialUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  username!: string;
  @ApiProperty()
  displayName!: string;
}

export class RelationshipResponseDto {
  @ApiProperty({ format: "uuid", description: "İlişkinin diğer kullanıcısı" })
  userId!: string;
  @ApiProperty({ enum: states })
  state!: RelationshipState;
}

export class SocialListItemDto {
  @ApiProperty({ type: SocialUserResponseDto })
  user!: SocialUserResponseDto;
  @ApiProperty({ enum: states })
  relationship!: RelationshipState;
  @ApiProperty({ type: String, format: "date-time", description: "Aramada hesap, ilişki listesinde mevcut istek döngüsünün oluşturulma zamanı." })
  createdAt!: Date;
}

export class SocialListResponseDto {
  @ApiProperty({ type: [SocialListItemDto] })
  items!: SocialListItemDto[];
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class BlockResponseDto {
  @ApiProperty({ format: "uuid" })
  blockedUserId!: string;
  @ApiProperty()
  blocked!: boolean;
}

export class BlockListItemDto {
  @ApiProperty({ format: "uuid" })
  blockedUserId!: string;
  @ApiProperty({ type: SocialUserResponseDto, nullable: true, description: "Hesap aktif değilse null; engeli kaldırmak için kimlik korunur." })
  user!: SocialUserResponseDto | null;
  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

export class BlockListResponseDto {
  @ApiProperty({ type: [BlockListItemDto] })
  items!: BlockListItemDto[];
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
