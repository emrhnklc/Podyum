import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import {
  DeviceReceiptDto, DeviceRemovedDto, InstallationParamsDto, MarkAllReadDto, MarkAllReadResultDto, NotificationIdParamsDto,
  NotificationListDto, NotificationReadDto, RegisterDeviceDto, UnreadCountDto,
} from "./dto/notifications.dto.js";
import { NotificationsService } from "./notifications.service.js";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("me/notifications")
  @ApiOkResponse({ type: NotificationListDto })
  @ApiOperation({ summary: "Kişisel bildirimler, son etkinlik önce; okunmamış sayısı dahil" })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) { return this.notifications.list(user.userId, query); }

  @Get("me/notifications/unread-count")
  @ApiOkResponse({ type: UnreadCountDto })
  @ApiOperation({ summary: "Sekme rozeti için okunmamış bildirim sayısı" })
  unreadCount(@CurrentUser() user: AuthenticatedUser) { return this.notifications.unreadCount(user.userId); }

  @Post("me/notifications/read-all")
  @HttpCode(200)
  @ApiOkResponse({ type: MarkAllReadResultDto })
  @ApiOperation({ summary: "Verilen ana kadarki bildirimleri okundu yap" })
  readAll(@CurrentUser() user: AuthenticatedUser, @Body() body: MarkAllReadDto) { return this.notifications.markAllRead(user.userId, body?.before); }

  @Put("me/notifications/:id/read")
  @ApiOkResponse({ type: NotificationReadDto })
  @ApiOperation({ summary: "Kendi bildirimini okundu yap; tekrar aynı sonucu verir" })
  read(@CurrentUser() user: AuthenticatedUser, @Param() params: NotificationIdParamsDto) { return this.notifications.markRead(user.userId, params.id); }

  @Put("me/devices/:installationId")
  @ApiOkResponse({ type: DeviceReceiptDto })
  @ApiOperation({ summary: "Bu kurulumun push anahtarını kaydet veya güncelle; kayıt bu oturuma bağlanır" })
  registerDevice(@CurrentUser() user: AuthenticatedUser, @Param() params: InstallationParamsDto, @Body() body: RegisterDeviceDto) {
    return this.notifications.registerDevice(user, params.installationId, body);
  }

  @Delete("me/devices/:installationId")
  @ApiOkResponse({ type: DeviceRemovedDto })
  @ApiOperation({ summary: "Bu kurulumun push kaydını kaldır; kayıt yoksa da başarılıdır" })
  removeDevice(@CurrentUser() user: AuthenticatedUser, @Param() params: InstallationParamsDto) {
    return this.notifications.removeDevice(user.userId, params.installationId);
  }
}
