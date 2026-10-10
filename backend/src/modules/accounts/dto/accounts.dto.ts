import { ApiProperty } from "@nestjs/swagger";
import { Equals } from "class-validator";

export class DeleteAccountDto {
  @ApiProperty({ enum: [true], description: "Kalıcı silmeyi açıkça onayla; işlem geri alınamaz." })
  @Equals(true) confirmDeletion!: true;
}
export class AccountDeletionReceiptDto {
  @ApiProperty({ format: "uuid" }) deletionId!: string;
  @ApiProperty({ enum: ["ACCEPTED"] }) status!: "ACCEPTED";
  @ApiProperty({ type: String, format: "date-time" }) requestedAt!: Date;
}
export class AccountDeletionStatusDto {
  @ApiProperty({ format: "uuid" }) deletionId!: string;
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ enum: ["PENDING", "COMPLETED"] }) status!: string;
  @ApiProperty({ type: String, format: "date-time" }) requestedAt!: Date;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) completedAt!: Date | null;
  @ApiProperty({ minimum: 0 }) pendingMedia!: number;
}
