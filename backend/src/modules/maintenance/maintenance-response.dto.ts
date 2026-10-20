import { ApiProperty } from "@nestjs/swagger";
export class MaintenanceStatusDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty({
    description: "Otomatik işçinin silme modu; false yalnız raporlar.",
  })
  apply!: boolean;
  @ApiProperty() intervalMs!: number;
  @ApiProperty({ enum: ["IDLE", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"] })
  status!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startedAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  finishedAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  lastSuccessAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  lastFailureAt!: Date | null;
  @ApiProperty() consecutiveFailures!: number;
  @ApiProperty({
    type: Object,
    nullable: true,
    description:
      "DB/posta/push/medya sayıları ve failedPhases. Özel alanlar, dizin, imleç ve token içermez.",
  })
  report!: Record<string, unknown> | null;
}
