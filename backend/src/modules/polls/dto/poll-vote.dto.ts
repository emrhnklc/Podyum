import { Transform } from "class-transformer";
import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PollStatus } from "../../../generated/prisma/enums.js";

export class CastPollVoteDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  optionId!: string;
}

export class PollVoteReceiptDto {
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ format: "uuid" }) optionId!: string;
  @ApiProperty({ type: String, format: "date-time" }) acceptedAt!: Date;
}

export class PollOptionResultDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: ["A", "B", "C", "D"] }) label!: string;
  @ApiProperty({ minimum: 0 }) votes!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) percentage!: number;
}

export class PollResultsDto {
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ enum: PollStatus, description: "Süreyi dikkate alan efektif durum." }) status!: PollStatus;
  @ApiProperty({ enum: PollStatus }) storedStatus!: PollStatus;
  @ApiProperty() isFinal!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) closesAt!: Date | null;
  @ApiProperty({ minimum: 0 }) totalVotes!: number;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) myOptionId!: string | null;
  @ApiProperty({ type: [String], description: "Açıkken anlık liderler, kapalıyken eşit birinciler; sıfır oyda boş." }) winningOptionIds!: string[];
  @ApiProperty({ type: [PollOptionResultDto] }) options!: PollOptionResultDto[];
}
