import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  PollCategory,
  CatalogProductStatus,
  CatalogSuggestionStatus,
} from "../../../generated/prisma/enums.js";
export class CatalogStoreDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() domain!: string;
}
export class CatalogStoreAdminDto extends CatalogStoreDto {
  @ApiProperty() active!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ type: [String] }) trackingParameters!: string[];
}
export class CatalogStoresDto {
  @ApiProperty({ type: [CatalogStoreAdminDto] }) items!: CatalogStoreAdminDto[];
}
export class CatalogProductDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ enum: PollCategory }) category!: PollCategory;
  @ApiProperty({ type: CatalogStoreDto, nullable: true })
  store!: CatalogStoreDto | null;
  @ApiProperty({ type: String, nullable: true }) externalId!: string | null;
  @ApiProperty() variantKey!: string;
  @ApiProperty({ type: String, nullable: true }) canonicalUrl!: string | null;
  @ApiProperty({ enum: ["ADMIN_REVIEWED"] }) source!: string;
  @ApiProperty({ enum: CatalogProductStatus }) status!: CatalogProductStatus;
  @ApiProperty({ type: Number, nullable: true }) priceMinor!: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  priceRecordedAt!: Date | null;
  @ApiProperty() version!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) redirectedFromId?:
    string | null;
}
export class CatalogProductPageDto {
  @ApiProperty({ type: [CatalogProductDto] }) items!: CatalogProductDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class CatalogResolveResultDto {
  @ApiProperty({ enum: ["EXACT", "CANDIDATES", "UNMATCHED"] }) match!: string;
  @ApiProperty({ type: String, nullable: true }) matchedBy!: string | null;
  @ApiProperty({ type: CatalogProductDto, nullable: true })
  product!: CatalogProductDto | null;
  @ApiProperty({ type: [CatalogProductDto] }) candidates!: CatalogProductDto[];
  @ApiProperty({ type: String, nullable: true }) originalUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) normalizedUrl!: string | null;
  @ApiProperty() storeSupported!: boolean;
  @ApiProperty() canSuggest!: boolean;
}
export class CatalogSuggestionDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ enum: PollCategory }) category!: PollCategory;
  @ApiProperty({ type: String, nullable: true }) originalUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) normalizedUrl!: string | null;
  @ApiProperty({ type: Number, nullable: true }) priceMinor!: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  priceRecordedAt!: Date | null;
  @ApiProperty({ enum: CatalogSuggestionStatus })
  status!: CatalogSuggestionStatus;
  @ApiProperty({ type: String, nullable: true }) resolvedProductId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) decisionReason!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiPropertyOptional({
    format: "uuid",
    description: "Yalnız yönetici yanıtında.",
  })
  submittedById?: string;
}
export class CatalogSuggestionPageDto {
  @ApiProperty({ type: [CatalogSuggestionDto] }) items!: CatalogSuggestionDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class CatalogMergeResultDto {
  @ApiProperty({ format: "uuid" }) sourceId!: string;
  @ApiProperty({ type: CatalogProductDto }) product!: CatalogProductDto;
}
