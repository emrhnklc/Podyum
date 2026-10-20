import { ApiProperty } from "@nestjs/swagger";
import {
  PollCategory,
  Gender,
  AgeBand,
} from "../../../generated/prisma/enums.js";
import { CatalogStoreDto } from "../../catalog/dto/catalog-response.dto.js";
import { TREND_PERIODS, type TrendPeriod } from "./trends.dto.js";

export class TrendProductDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ enum: PollCategory }) category!: PollCategory;
  @ApiProperty({ type: CatalogStoreDto, nullable: true })
  store!: CatalogStoreDto | null;
  @ApiProperty({ type: String, nullable: true }) canonicalUrl!: string | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Güncel katalog fiyatı; filtredeki yayın anı fiyatından farklı olabilir",
  })
  priceMinor!: number | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  priceRecordedAt!: string | null;
  @ApiProperty() version!: number;
}
export class TrendItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() rank!: number;
  @ApiProperty({
    description:
      "Hesap/ürün/gün tekil katkılarının dönem toplamı; doğrudan ürün oyu veya satış değil",
  })
  score!: number;
  @ApiProperty({ minimum: 5 }) distinctVoters!: number;
  @ApiProperty({ format: "date-time" }) latestSignalAt!: string;
  @ApiProperty({ type: TrendProductDto }) product!: TrendProductDto;
}
class TrendPeriodDto {
  @ApiProperty({ enum: TREND_PERIODS }) period!: TrendPeriod;
  @ApiProperty({ format: "date" }) anchorDate!: string;
  @ApiProperty({ format: "date" }) startDate!: string;
  @ApiProperty({ format: "date", description: "Hariç üst sınır" })
  endDate!: string;
  @ApiProperty({ format: "date-time" }) startsAt!: string;
  @ApiProperty({ format: "date-time" }) endsAt!: string;
  @ApiProperty({ enum: ["Europe/Istanbul"] }) timeZone!: string;
}
class TrendFiltersDto {
  @ApiProperty({ enum: PollCategory, nullable: true })
  category!: PollCategory | null;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ enum: Gender, nullable: true }) gender!: Gender | null;
  @ApiProperty({ enum: AgeBand, nullable: true }) ageBand!: AgeBand | null;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: Number, nullable: true }) minPriceMinor!: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxPriceMinor!: number | null;
}
class TrendPolicyDto {
  @ApiProperty() version!: number;
  @ApiProperty({ enum: ["PRODUCTS_IN_PREFERRED_OUTFITS"] })
  measurement!: string;
  @ApiProperty({ enum: ["Europe/Istanbul"] }) timeZone!: string;
  @ApiProperty({ enum: ["CALENDAR"] }) day!: string;
  @ApiProperty({ enum: ["MONDAY"] }) weekStartsOn!: string;
  @ApiProperty({ enum: ["CALENDAR"] }) month!: string;
  @ApiProperty({ enum: ["FIRST_ELIGIBLE_VOTE_PER_VOTER_PRODUCT_DAY"] })
  score!: string;
  @ApiProperty() minimumDistinctVoters!: number;
}
export class TrendsPageDto {
  @ApiProperty({ enum: ["READY", "NO_DATA", "INSUFFICIENT_SAMPLE"] })
  status!: string;
  @ApiProperty({ type: [TrendItemDto] }) items!: TrendItemDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
  @ApiProperty({ type: TrendPeriodDto }) period!: TrendPeriodDto;
  @ApiProperty({ type: TrendFiltersDto }) filters!: TrendFiltersDto;
  @ApiProperty({ enum: ["GENERAL_PREFERENCES", "CONSENTED_VOTER_SNAPSHOT"] })
  population!: string;
  @ApiProperty({ type: TrendPolicyDto }) policy!: TrendPolicyDto;
  @ApiProperty({ enum: ["PUBLICATION_SNAPSHOT"] }) priceBasis!: string;
  @ApiProperty({ enum: ["CURRENT_CATALOG"] }) productBasis!: string;
  @ApiProperty({ enum: ["EVENTUAL"] }) consistency!: string;
  @ApiProperty({
    format: "date-time",
    description: "Bu listenin dahil ettiği en son oy zamanı üst sınırı",
  })
  asOf!: string;
  @ApiProperty({
    format: "date-time",
    description:
      "Hesaplama zamanı; bütün outbox olayları işlendi demek değildir",
  })
  computedAt!: string;
}
