import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsUUID, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { MediaPurpose } from "../../../generated/prisma/enums.js";
import { IMAGE_MIMES, MEDIA_LIMITS } from "../media.constants.js";

const supplied = (_object: unknown, value: unknown) => value !== undefined;

export class MediaIdParamsDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  id!: string;
}

export class CreateUploadDto {
  @ApiProperty({ enum: MediaPurpose })
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;

  @ApiProperty({ enum: IMAGE_MIMES })
  @IsIn(IMAGE_MIMES)
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: MEDIA_LIMITS.maxBytes })
  @IsInt()
  @Min(1)
  @Max(MEDIA_LIMITS.maxBytes)
  byteSize!: number;

  @ApiPropertyOptional({ description: "Gönderilmezse kullanıcının defaultBlurFace tercihi kullanılır." })
  @ValidateIf(supplied)
  @IsBoolean()
  blurRequested?: boolean;
}

export class BlurRegionDto {
  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @ApiProperty({ exclusiveMinimum: true, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0.001)
  @Max(1)
  width!: number;

  @ApiProperty({ exclusiveMinimum: true, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0.001)
  @Max(1)
  height!: number;
}

export class CompleteMediaDto {
  @ApiPropertyOptional({ type: [BlurRegionDto], maxItems: 10, description: "EXIF yönü düzeltilmiş görüntü üzerinde 0–1 koordinatlı bölgeler. Otomatik yüz tespiti değildir." })
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BlurRegionDto)
  blurRegions?: BlurRegionDto[];

  @ApiPropertyOptional({ description: "Blur açık ve bölge yoksa kullanıcı fotoğrafta yüz olmadığını açıkça doğrular." })
  @ValidateIf(supplied)
  @IsBoolean()
  confirmNoFaces?: boolean;
}

export class AcceptPreviewDto {
  @ApiProperty({ enum: [true], description: "İşlenmiş önizlemenin kullanıcı tarafından onaylandığını belirtir." })
  @IsIn([true])
  confirmed!: true;
}

export class SetAvatarDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID()
  mediaId!: string;
}

export class MediaContentQueryDto {
  @ApiPropertyOptional({ enum: ["display", "thumbnail"], default: "display" })
  @ValidateIf(supplied)
  @IsIn(["display", "thumbnail"])
  variant?: "display" | "thumbnail";
}
