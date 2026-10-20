import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import {
  CatalogProductStatus,
  CatalogSuggestionStatus,
  PollCategory,
} from "../../../generated/prisma/enums.js";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const provided = (_o: unknown, value: unknown) => value !== undefined;
const nonnull = (_o: unknown, value: unknown) =>
  value !== undefined && value !== null;
export class CatalogIdDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
}
export class CatalogQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(2, 150)
  q?: string;
  @ApiPropertyOptional({ enum: PollCategory })
  @ValidateIf(provided)
  @IsEnum(PollCategory)
  category?: PollCategory;
}
export class AdminCatalogQueryDto extends CatalogQueryDto {
  @ApiPropertyOptional({ enum: CatalogProductStatus })
  @ValidateIf(provided)
  @IsEnum(CatalogProductStatus)
  status?: CatalogProductStatus;
}
export class CatalogResolveDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 2048)
  url?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(2, 150)
  query?: string;
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  brand?: string;
}
export class CatalogSuggestionCreateDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 150)
  title!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trim)
  @ValidateIf(nonnull)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  brand?: string | null;
  @ApiProperty({ enum: PollCategory })
  @IsEnum(PollCategory)
  category!: PollCategory;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trim)
  @ValidateIf(nonnull)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 2048)
  url?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  @ValidateIf(nonnull)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceMinor?: number | null;
  @ApiPropertyOptional({ default: "TRY" })
  @IsIn(["TRY", "EUR", "USD", "GBP"])
  currency: string = "TRY";
}
export class SuggestionQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: CatalogSuggestionStatus })
  @ValidateIf(provided)
  @IsEnum(CatalogSuggestionStatus)
  status?: CatalogSuggestionStatus;
}
export class CatalogStoreCreateDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  name!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 253)
  domain!: string;
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9_-]{1,40}$/, { each: true })
  trackingParameters: string[] = [];
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogVersionDto {
  @ApiProperty() @IsInt() @Min(0) @Max(2147483646) expectedVersion!: number;
}
export class CatalogStoreUpdateDto extends CatalogVersionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  name!: string;
  @ApiProperty() @IsBoolean() active!: boolean;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogProductCreateDto extends CatalogSuggestionCreateDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(nonnull)
  @IsUUID()
  storeId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trim)
  @ValidateIf(nonnull)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 120)
  externalId?: string | null;
  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(0, 120)
  variantKey: string = "";
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogProductUpdateDto extends CatalogVersionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 150)
  title!: string;
  @ApiProperty({ type: String, nullable: true })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  brand!: string | null;
  @ApiProperty({ enum: PollCategory })
  @IsEnum(PollCategory)
  category!: PollCategory;
  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceMinor!: number | null;
  @ApiProperty() @IsIn(["TRY", "EUR", "USD", "GBP"]) currency!: string;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] })
  @IsIn(["ACTIVE", "ARCHIVED"])
  status!: "ACTIVE" | "ARCHIVED";
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogAliasDto extends CatalogVersionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 2048)
  url!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogMergeDto extends CatalogVersionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() targetId!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483646) targetVersion!: number;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class CatalogSuggestionDecisionDto extends CatalogVersionDto {
  @ApiProperty({ enum: ["APPROVE", "REJECT"] })
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";
  @ApiPropertyOptional({ format: "uuid" })
  @ValidateIf(provided)
  @IsUUID()
  productId?: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
