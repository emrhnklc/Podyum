import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import {
  AgeBand,
  Gender,
  PollCategory,
} from "../../../generated/prisma/enums.js";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";

export const TREND_PERIODS = ["DAY", "WEEK", "MONTH"] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];
const provided = (_object: unknown, value: unknown) => value !== undefined;
const integer = ({ value }: { value: unknown }) =>
  typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;

export class TrendsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: TREND_PERIODS, default: "WEEK" })
  @IsIn(TREND_PERIODS)
  period: TrendPeriod = "WEEK";

  @ApiPropertyOptional({
    description: "Europe/Istanbul takvim tarihi; varsayılan bugün",
    example: "2026-10-20",
  })
  @ValidateIf(provided)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ enum: PollCategory })
  @ValidateIf(provided)
  @IsEnum(PollCategory)
  category?: PollCategory;

  @ApiPropertyOptional({
    description:
      "Yayın anındaki markayla tam eşleşme (büyük/küçük harfe duyarlı)",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @ValidateIf(provided)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 100)
  brand?: string;

  @ApiPropertyOptional({
    enum: Gender,
    description: "İzinli oy verenin oy anındaki cinsiyeti",
  })
  @ValidateIf(provided)
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    enum: AgeBand,
    description: "İzinli oy verenin oy anındaki yaş grubu",
  })
  @ValidateIf(provided)
  @IsEnum(AgeBand)
  ageBand?: AgeBand;

  @ApiPropertyOptional({ enum: ["TRY", "EUR", "USD", "GBP"], default: "TRY" })
  @IsIn(["TRY", "EUR", "USD", "GBP"])
  currency: string = "TRY";

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: "Yayın anı fiyatı, en küçük para birimi; dahil",
  })
  @Transform(integer)
  @ValidateIf(provided)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPriceMinor?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: "Yayın anı fiyatı, en küçük para birimi; dahil",
  })
  @Transform(integer)
  @ValidateIf(provided)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxPriceMinor?: number;
}
