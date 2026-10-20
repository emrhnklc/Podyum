import { ApiProperty } from "@nestjs/swagger";
export class ManagedGameThemeDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() version!: number;
}
export class ManagedGameThemeListDto {
  @ApiProperty({ type: [ManagedGameThemeDto] }) items!: ManagedGameThemeDto[];
}
export class DailyGameScheduleDto {
  @ApiProperty() version!: number;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ enum: ["DATABASE", "ENVIRONMENT", "UNCONFIGURED"] })
  source!: string;
  @ApiProperty({ type: String, nullable: true }) startTime!: string | null;
  @ApiProperty({ type: String, nullable: true }) timeZone!: string | null;
  @ApiProperty({ type: String, nullable: true }) themeSlug!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  updatedAt!: Date | null;
}
