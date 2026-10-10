import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsString, IsUUID, Length, Matches, ValidateIf } from "class-validator";
import { NOTIFICATION_TYPES, type NotificationTargetType, type NotificationType } from "../notification-catalog.js";

const lower = ({ value }: { value: unknown }) => typeof value === "string" ? value.toLowerCase() : value;

export class NotificationIdParamsDto {
  @ApiProperty({ format: "uuid" })
  @Transform(lower)
  @IsUUID()
  id!: string;
}

export class InstallationParamsDto {
  @ApiProperty({ format: "uuid", description: "Uygulamanın kurulumda bir kez ürettiği ve sakladığı kimlik." })
  @Transform(lower)
  @IsUUID()
  installationId!: string;
}

export class MarkAllReadDto {
  @ApiPropertyOptional({ type: String, format: "date-time", description: "Bu ana kadar olanlar okunur; listeden alınan serverNow gönderilirse ekranda görülmeyen yeni bildirim okunmuş sayılmaz. Gönderilmezse şimdi." })
  @ValidateIf((_object, value) => value !== undefined)
  @IsISO8601({ strict: true })
  before?: string;
}

export class RegisterDeviceDto {
  @ApiProperty({ minLength: 1, maxLength: 512, description: "Push sağlayıcısının verdiği cihaz anahtarı (ör. Expo push token)." })
  @IsString()
  @Length(1, 512)
  @Matches(/^\S+$/)
  token!: string;

  @ApiProperty({ enum: ["ios", "android"] })
  @IsIn(["ios", "android"])
  platform!: "ios" | "android";
}

export class NotificationActorDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) avatarPath!: string | null;
}

export class NotificationTargetDto {
  @ApiProperty({ enum: ["USER", "POLL", "GAME"], description: "Dokununca açılacak ekran: profil, paylaşım veya oyun." })
  type!: NotificationTargetType;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true, description: "Paylaşımın sorusu veya oyunun teması; hedef artık görülemiyorsa null." })
  title!: string | null;
}

export class NotificationDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: NOTIFICATION_TYPES, description: "Görünen metni mobil bu türe göre üretir." }) type!: NotificationType;
  @ApiProperty({ type: String, format: "date-time", description: "Son etkinlik zamanı; gruplu bildirimde son yorumun zamanı." }) createdAt!: Date;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) readAt!: Date | null;
  @ApiProperty({ minimum: 1, description: "Gruplu bildirimde okunmamış yorum sayısı; diğer türlerde 1." }) count!: number;
  @ApiProperty({ type: NotificationActorDto, nullable: true, description: "İşlemi yapan kişi; gruplu bildirimde son yorumu yazan." }) actor!: NotificationActorDto | null;
  @ApiProperty({ type: NotificationTargetDto }) target!: NotificationTargetDto;
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto] }) items!: NotificationDto[];
  @ApiProperty({ minimum: 0 }) unreadCount!: number;
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class UnreadCountDto {
  @ApiProperty({ minimum: 0 }) unreadCount!: number;
}

export class NotificationReadDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: [true] }) isRead!: true;
  @ApiProperty({ type: String, format: "date-time" }) readAt!: Date;
}

export class MarkAllReadResultDto {
  @ApiProperty({ minimum: 0 }) updated!: number;
  @ApiProperty({ minimum: 0 }) unreadCount!: number;
}

export class DeviceReceiptDto {
  @ApiProperty({ format: "uuid" }) installationId!: string;
  @ApiProperty({ enum: ["ios", "android"] }) platform!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
}

export class DeviceRemovedDto {
  @ApiProperty({ format: "uuid" }) installationId!: string;
  @ApiProperty({ enum: [true] }) removed!: true;
}
