import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsUUID, Matches } from "class-validator";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";

const lower = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim().toLowerCase() : value;

export class TargetUserDto {
  @ApiProperty({ type: String, format: "uuid" })
  @Transform(lower)
  @IsUUID()
  targetUserId!: string;
}

export class SocialUserParamsDto {
  @ApiProperty({ type: String, format: "uuid" })
  @Transform(lower)
  @IsUUID()
  userId!: string;
}

export class UserSearchQueryDto extends PageQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 30, description: "Kullanıcı adı başlangıcı; küçük harfe normalize edilir." })
  @Transform(lower)
  @Matches(/^[a-z0-9_]{2,30}$/)
  q!: string;
}

export class FriendRequestsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ["incoming", "outgoing"], default: "incoming" })
  @IsIn(["incoming", "outgoing"])
  direction: "incoming" | "outgoing" = "incoming";
}
