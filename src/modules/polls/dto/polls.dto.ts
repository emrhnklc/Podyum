import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsString, IsUrl, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from "class-validator";
import { PollCategory, PollStatus, Visibility } from "../../../generated/prisma/enums.js";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const supplied = (_object: unknown, value: unknown) => value !== undefined;
const nonNull = (_object: unknown, value: unknown) => value !== undefined && value !== null;
const field = (key: string) => (value: unknown) => value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;

export class PollIdParamsDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  id!: string;
}

export class ProductTagInputDto {
  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100 })
  @Transform(trim)
  @ValidateIf(nonNull)
  @IsString()
  @Length(1, 100)
  brand?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: 2_147_483_647, description: "En küçük para biriminde kullanıcı beyanı; TRY için kuruş." })
  @ValidateIf(nonNull)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  priceMinor?: number | null;

  @ApiPropertyOptional({ default: "TRY", pattern: "^[A-Z]{3}$", description: "Üç harfli para birimi beyanı; döviz dönüşümü yapılmaz." })
  @Transform(({ value }) => typeof value === "string" ? value.trim().toUpperCase() : value)
  @ValidateIf(supplied)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiProperty({ maxLength: 2048, description: "Özgün http/https ürün linki; sunucu bu linki taramaz. Ticari hak doğrulaması henüz bağlı değil." })
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  @Matches(/^[^\s\u0000-\u001f\u007f]+$/)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_valid_protocol: true, disallow_auth: true })
  externalUrl!: string;
}

export class PollOptionInputDto {
  @ApiProperty({ minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  position!: number;

  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  mediaId!: string;

  @ApiPropertyOptional({ type: [ProductTagInputDto], maxItems: 10 })
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductTagInputDto)
  products?: ProductTagInputDto[];
}

export class PollContentDto {
  @ApiPropertyOptional({ maxLength: 280, description: "Taslak boş olabilir; yayın için soru gerekli." })
  @Transform(trim)
  @ValidateIf(supplied)
  @IsString()
  @MaxLength(280)
  question?: string;

  @ApiPropertyOptional({ enum: PollCategory, default: PollCategory.OUTFIT })
  @ValidateIf(supplied)
  @IsEnum(PollCategory)
  category?: PollCategory;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60 })
  @Transform(trim)
  @ValidateIf(nonNull)
  @IsString()
  @Length(1, 60)
  occasion?: string | null;

  @ApiPropertyOptional({ enum: Visibility, description: "Oluştururken gönderilmezse profil ayarı kullanılır." })
  @ValidateIf(supplied)
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({ description: "Oluştururken gönderilmezse profil ayarı kullanılır." })
  @ValidateIf(supplied)
  @IsBoolean()
  commentsEnabled?: boolean;

  @ApiPropertyOptional({ enum: [1800, 7200, 86400], default: 1800 })
  @ValidateIf(supplied)
  @IsIn([1800, 7200, 86400])
  durationSeconds?: number;

  @ApiPropertyOptional({ type: [PollOptionInputDto], maxItems: 4, description: "Tam seçenek listesi; taslakta 0–4, yayında 2–4. Her position ve mediaId farklıdır." })
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique(field("position"))
  @ArrayUnique(field("mediaId"))
  @ValidateNested({ each: true })
  @Type(() => PollOptionInputDto)
  options?: PollOptionInputDto[];
}

export class CreatePollDto extends PollContentDto {}

export class PollVersionDto {
  @ApiProperty({ minimum: 0, maximum: 2_147_483_646, description: "Son yanıttaki version; eski sürüm 409 VERSION_CONFLICT." })
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedVersion!: number;
}

export class UpdatePollDto extends PollContentDto {
  @ApiProperty({ minimum: 0, maximum: 2_147_483_646 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedVersion!: number;
}

export class DeleteDraftQueryDto {
  @ApiProperty({ minimum: 0, maximum: 2_147_483_646 })
  @Transform(({ value }) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedVersion!: number;
}

export class MyPollsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PollStatus, description: "OPEN/CLOSED filtresi son süreyi de dikkate alır." })
  @ValidateIf(supplied)
  @IsEnum(PollStatus)
  status?: PollStatus;
}

export class UpdateCommentSettingsDto extends PollVersionDto {
  @ApiProperty()
  @IsBoolean()
  commentsEnabled!: boolean;
}
