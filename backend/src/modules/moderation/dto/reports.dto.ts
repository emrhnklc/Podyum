import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsString, IsUUID, Length, ValidateIf } from "class-validator";
import { ReportReason, ReportStatus, ReportTargetType } from "../../../generated/prisma/enums.js";

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty({ format: "uuid", description: "targetType'a göre oylama, yorum veya kullanıcı kimliği." })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  targetId!: string;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @ApiPropertyOptional({ minLength: 1, maxLength: 500, description: "İsteğe bağlı kısa açıklama; baştaki/sondaki boşluk kırpılır." })
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class ReportReceiptDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ReportTargetType }) targetType!: ReportTargetType;
  @ApiProperty({ format: "uuid" }) targetId!: string;
  @ApiProperty({ enum: ReportReason }) reason!: ReportReason;
  @ApiProperty({ enum: ReportStatus }) status!: ReportStatus;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
}
