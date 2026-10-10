import { ApiProperty } from "@nestjs/swagger";
import { MediaPurpose, MediaStatus } from "../../../generated/prisma/enums.js";
import { MEDIA_LIMITS } from "../media.constants.js";

export class MediaResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: MediaPurpose }) purpose!: MediaPurpose;
  @ApiProperty({ enum: MediaStatus }) status!: MediaStatus;
  @ApiProperty() blurRequested!: boolean;
  @ApiProperty({ type: String, nullable: true }) mimeType!: string | null;
  @ApiProperty({ type: Number, nullable: true }) byteSize!: number | null;
  @ApiProperty({ type: Number, nullable: true }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true }) height!: number | null;
  @ApiProperty() uploaded!: boolean;
  @ApiProperty({ type: String, nullable: true }) rejectionCode!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) previewAcceptedAt!: Date | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
  @ApiProperty({ type: String, nullable: true }) displayPath!: string | null;
  @ApiProperty({ type: String, nullable: true }) thumbnailPath!: string | null;
}

export class UploadGrantDto {
  @ApiProperty({ enum: ["POST"] }) method!: "POST";
  @ApiProperty() path!: string;
  @ApiProperty({ description: "Yalnız bu yanıtta döner. Bearer oturumu yanında X-Upload-Token başlığına konur." }) token!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: Date;
  @ApiProperty({ enum: ["file"] }) field!: "file";
  @ApiProperty({ example: MEDIA_LIMITS.maxBytes }) maxBytes!: number;
}

export class CreateUploadResponseDto {
  @ApiProperty({ type: MediaResponseDto }) asset!: MediaResponseDto;
  @ApiProperty({ type: UploadGrantDto }) upload!: UploadGrantDto;
}

export class AvatarResponseDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true }) avatarMediaId!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarPath!: string | null;
}

export class DeleteMediaResponseDto {
  @ApiProperty({ enum: [true] }) deleted!: true;
}
