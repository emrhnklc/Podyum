import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsString, IsUUID, Length, Min, ValidateIf } from "class-validator";
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { PageQueryDto } from "../../../common/pagination/page-query.dto.js";
import { AdminResourceType, ContentStatus, ModerationAction, PollStatus, Visibility, ReportStatus, ReportTargetType, UserStatus } from "../../../generated/prisma/enums.js";
import { ReportReceiptDto } from "./reports.dto.js";

export enum ReviewDecision { DISMISS = "DISMISS", NO_ACTION = "NO_ACTION", HIDE_POLL = "HIDE_POLL", REMOVE_COMMENT = "REMOVE_COMMENT", SUSPEND_USER = "SUSPEND_USER" }
export enum PollVisibility { VISIBLE = "VISIBLE", HIDDEN = "HIDDEN" }
export enum AccountStatus { ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED" }

export class AdminIdDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID() id!: string;
}
export class AdminReportMediaDto extends AdminIdDto {
  @ApiProperty({ format: "uuid" })
  @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
  @IsUUID() mediaId!: string;
}
export class AdminReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: "İç denetim gerekçesi; özel veri veya token eklemeyin." })
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString() @Length(3, 500) reason!: string;
}
export class AdminVersionDto extends AdminReasonDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedVersion!: number;
}
export class ReviewReportDto extends AdminVersionDto {
  @ApiProperty({ enum: ReviewDecision }) @IsEnum(ReviewDecision) decision!: ReviewDecision;
}
export class AdminPollVisibilityDto extends AdminVersionDto {
  @ApiProperty({ enum: PollVisibility }) @IsEnum(PollVisibility) contentStatus!: PollVisibility;
}
export class AdminUserStatusDto extends AdminReasonDto {
  @ApiProperty({ enum: AccountStatus }) @IsEnum(AccountStatus) status!: AccountStatus;
}
export class AdminReportsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.OPEN }) @IsEnum(ReportStatus) status: ReportStatus = ReportStatus.OPEN;
  @ApiPropertyOptional({ enum: ReportTargetType }) @ValidateIf((_o, v) => v !== undefined) @IsEnum(ReportTargetType) targetType?: ReportTargetType;
}
export class AdminAuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: AdminResourceType }) @ValidateIf((_o, v) => v !== undefined) @IsEnum(AdminResourceType) resourceType?: AdminResourceType;
  @ApiPropertyOptional({ format: "uuid" }) @ValidateIf((_o, v) => v !== undefined) @IsUUID() resourceId?: string;
}
export class AdminMeDto {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty({ enum: ["ADMIN"] }) role!: string;
}
export class AdminActionReceiptDto {
  @ApiProperty({ format: "uuid" }) auditId!: string;
  @ApiProperty({ enum: AdminResourceType }) resourceType!: AdminResourceType;
  @ApiProperty({ format: "uuid" }) resourceId!: string;
  @ApiProperty({ type: String, format: "date-time" }) appliedAt!: Date;
}
export class AdminReportReceiptDto extends AdminActionReceiptDto {
  @ApiProperty({ enum: ReportStatus }) status!: ReportStatus;
  @ApiProperty({ minimum: 1 }) version!: number;
}

export class AdminReportSummaryDto extends ReportReceiptDto {
  @ApiProperty({ minimum: 0 }) version!: number;
}
export class AdminReportsPageDto {
  @ApiProperty({ type: [AdminReportSummaryDto] }) items!: AdminReportSummaryDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
export class AdminUserSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
}
export class AdminPollOptionDto {
  @ApiProperty({ minimum: 0 }) position!: number;
  @ApiProperty({ format: "uuid" }) mediaId!: string;
  @ApiProperty() previewPath!: string;
}
export class AdminPollTargetDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) authorId!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ enum: ContentStatus }) contentStatus!: ContentStatus;
  @ApiProperty({ enum: Visibility }) visibility!: Visibility;
  @ApiProperty({ enum: PollStatus }) status!: PollStatus;
  @ApiProperty({ minimum: 0 }) version!: number;
  @ApiProperty({ type: [AdminPollOptionDto] }) options!: AdminPollOptionDto[];
}
export class AdminCommentTargetDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) pollId!: string;
  @ApiProperty({ format: "uuid" }) authorId!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: ContentStatus }) contentStatus!: ContentStatus;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) removedAt!: Date | null;
}
@ApiExtraModels(AdminPollTargetDto, AdminCommentTargetDto, AdminUserSummaryDto)
export class AdminReportDetailDto extends AdminReportSummaryDto {
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ type: String, nullable: true }) decisionNote!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) reviewedAt!: Date | null;
  @ApiProperty({ type: AdminUserSummaryDto }) reporter!: AdminUserSummaryDto;
  @ApiProperty({ type: AdminUserSummaryDto, nullable: true }) reviewedBy!: AdminUserSummaryDto | null;
  @ApiProperty({ nullable: true, description: "targetType sırasıyla POLL, COMMENT veya USER; hedef yoksa null.",
    oneOf: [AdminPollTargetDto, AdminCommentTargetDto, AdminUserSummaryDto].map((dto) => ({ $ref: getSchemaPath(dto) })) })
  target!: AdminPollTargetDto | AdminCommentTargetDto | AdminUserSummaryDto | null;
}
export class AdminAuditEntryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true, description: "Yalnız yerel ilk rol atamasında null." }) actorId!: string | null;
  @ApiProperty({ enum: ModerationAction }) action!: ModerationAction;
  @ApiProperty({ enum: AdminResourceType }) resourceType!: AdminResourceType;
  @ApiProperty({ format: "uuid" }) resourceId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) reportId!: string | null;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: "object", additionalProperties: true, description: "İşlem öncesi durum/sürüm; ham içerik veya oturum anahtarı içermez." }) before!: Record<string, unknown>;
  @ApiProperty({ type: "object", additionalProperties: true }) after!: Record<string, unknown>;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
}
export class AdminAuditPageDto {
  @ApiProperty({ type: [AdminAuditEntryDto] }) items!: AdminAuditEntryDto[];
  @ApiProperty({ type: String, format: "date-time" }) serverNow!: Date;
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
