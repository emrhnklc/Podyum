import { ApiProperty } from "@nestjs/swagger";
import { AgeBand, Gender, Visibility } from "../../../generated/prisma/enums.js";

export class StyleTagResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  label!: string;
}

export class ProfileCountsDto {
  @ApiProperty({ minimum: 0, description: "İzleyiciye görünür OPEN/CLOSED paylaşımlar; taslak, iptal ve kaldırılmış içerik hariç." })
  polls!: number;
  @ApiProperty({ minimum: 0, description: "Aktif, engel ilişkisi olmayan kabul edilmiş arkadaşlar." })
  friends!: number;
  @ApiProperty({ description: "Mevcut sunucu ledger toplamı. Bu API puan üretmez; oyun ödülleri Faz 2'de." })
  stars!: number;
}

export class PublicProfileResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  username!: string;
  @ApiProperty()
  displayName!: string;
  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;
  @ApiProperty({ type: String, format: "uuid", nullable: true })
  avatarMediaId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "Bearer oturumu ile açılan işlenmiş avatar." })
  avatarPath!: string | null;
  @ApiProperty({ type: [StyleTagResponseDto] })
  styles!: StyleTagResponseDto[];
  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: Date;
  @ApiProperty({ type: ProfileCountsDto })
  counts!: ProfileCountsDto;
}

export class MyProfileResponseDto {
  @ApiProperty({ type: PublicProfileResponseDto })
  profile!: PublicProfileResponseDto;
  @ApiProperty({ description: "Mock ilk kurulumda username ve displayName aynı PATCH /me isteğinde gönderilir." })
  profileSetupRequired!: boolean;
}

export class PrivateProfileResponseDto {
  @ApiProperty({ enum: Gender, nullable: true })
  gender!: Gender | null;
  @ApiProperty({ enum: AgeBand, nullable: true })
  ageBand!: AgeBand | null;
  @ApiProperty({ type: String, nullable: true })
  cityCode!: string | null;
  @ApiProperty()
  analyticsConsent!: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  analyticsConsentAt!: Date | null;
  @ApiProperty({ minimum: 0, description: "İzin/demografi değişikliklerinin monoton sürümü." })
  analyticsRevision!: number;
}

export class SettingsResponseDto {
  @ApiProperty({ default: true })
  pushEnabled!: boolean;
  @ApiProperty({ default: true })
  friendRequestNotifications!: boolean;
  @ApiProperty({ default: true })
  pollResultNotifications!: boolean;
  @ApiProperty({ default: true })
  commentNotifications!: boolean;
  @ApiProperty({ default: true })
  gameNotifications!: boolean;
  @ApiProperty({ enum: Visibility, default: Visibility.PUBLIC })
  defaultPollVisibility!: Visibility;
  @ApiProperty({ default: true })
  defaultCommentsEnabled!: boolean;
  @ApiProperty({ default: true })
  defaultBlurFace!: boolean;
}

export class UsernameAvailabilityResponseDto {
  @ApiProperty()
  username!: string;
  @ApiProperty({ description: "Anlık bilgi; kullanıcı adı yalnızca kayıt/güncelleme transaction'ında alınır." })
  available!: boolean;
}
