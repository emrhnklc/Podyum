import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from "class-validator";
import { GameVersionDto } from "./games.dto.js";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class GameThemeCreateDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,79}$/)
  slug!: string;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 120)
  title!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class GameThemeUpdateDto extends GameVersionDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 120)
  title!: string;
  @ApiProperty() @IsBoolean() active!: boolean;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
export class GameScheduleUpdateDto extends GameVersionDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(1, 80)
  timeZone?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,79}$/)
  themeSlug?: string | null;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Matches(/^[^\x00]*$/)
  @Length(3, 500)
  reason!: string;
}
