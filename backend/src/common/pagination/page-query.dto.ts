import { Transform } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class PageQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50, type: Number })
  @Transform(({ value }) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({ maxLength: 2048 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2048)
  cursor?: string;
}
