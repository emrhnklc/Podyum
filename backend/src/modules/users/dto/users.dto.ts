import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from "class-validator";
import { AgeBand, Gender, Visibility } from "../../../generated/prisma/enums.js";
import { AUTH_RULES } from "../../auth/auth.constants.js";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim().toLowerCase() : value;
const supplied = (_object: unknown, value: unknown) => value !== undefined;
const nonNull = (_object: unknown, value: unknown) => value !== undefined && value !== null;

export class UserIdParamsDto {
  @ApiProperty({ type: String, format: "uuid" })
  @Transform(lower)
  @IsUUID()
  id!: string;
}

export class UsernameQueryDto {
  @ApiProperty({ example: "elifyz", pattern: "^[a-z0-9_]{3,30}$" })
  @Transform(lower)
  @Matches(AUTH_RULES.usernamePattern)
  username!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ pattern: "^[a-z0-9_]{3,30}$" })
  @Transform(lower)
  @ValidateIf(supplied)
  @Matches(AUTH_RULES.usernamePattern)
  username?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @ValidateIf(supplied)
  @IsString()
  @Length(1, 80)
  displayName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 300, description: "null veya boş metin bio'yu temizler." })
  @Transform(trim)
  @ValidateIf(nonNull)
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 10, uniqueItems: true, description: "Stil sözlüğündeki id'ler; [] tüm seçimleri temizler." })
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9_-]{1,40}$/, { each: true })
  styleIds?: string[];
}

export class UpdatePrivateProfileDto {
  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @ValidateIf(nonNull)
  @IsEnum(Gender)
  gender?: Gender | null;

  @ApiPropertyOptional({ enum: AgeBand, nullable: true })
  @ValidateIf(nonNull)
  @IsEnum(AgeBand)
  ageBand?: AgeBand | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 30, description: "İsteğe bağlı şehir kodu; konum tespiti veya doğrulanmış şehir listesi değildir." })
  @Transform(({ value }) => typeof value === "string" ? value.trim().toUpperCase() : value)
  @ValidateIf(nonNull)
  @Matches(/^[A-Z0-9][A-Z0-9_-]{0,29}$/)
  cityCode?: string | null;

  @ApiPropertyOptional({ type: Boolean, description: "Demografik trend analizi izni. Varsayılan kapalı; false izni geri alır." })
  @ValidateIf(supplied)
  @IsBoolean()
  analyticsConsent?: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ default: true })
  @ValidateIf(supplied)
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @ValidateIf(supplied)
  @IsBoolean()
  friendRequestNotifications?: boolean;

  @ApiPropertyOptional({ default: true })
  @ValidateIf(supplied)
  @IsBoolean()
  pollResultNotifications?: boolean;

  @ApiPropertyOptional({ default: true })
  @ValidateIf(supplied)
  @IsBoolean()
  commentNotifications?: boolean;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PUBLIC })
  @ValidateIf(supplied)
  @IsEnum(Visibility)
  defaultPollVisibility?: Visibility;

  @ApiPropertyOptional({ default: true })
  @ValidateIf(supplied)
  @IsBoolean()
  defaultCommentsEnabled?: boolean;

  @ApiPropertyOptional({ default: true, description: "Yeni medya izninin varsayılan blur tercihi; manuel bölge seçimi/önizleme gerekir, otomatik yüz tespiti değildir." })
  @ValidateIf(supplied)
  @IsBoolean()
  defaultBlurFace?: boolean;
}
