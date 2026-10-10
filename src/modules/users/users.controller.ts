import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { UsersService } from "./users.service.js";
import { UpdatePrivateProfileDto, UpdateProfileDto, UpdateSettingsDto, UserIdParamsDto, UsernameQueryDto } from "./dto/users.dto.js";
import { MyProfileResponseDto, PrivateProfileResponseDto, PublicProfileResponseDto, SettingsResponseDto, StyleTagResponseDto, UsernameAvailabilityResponseDto } from "./dto/users-response.dto.js";

@ApiTags("users")
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiOperation({ summary: "Kendi profilin ve ilk kurulum durumu" })
  me(@CurrentUser() user: AuthenticatedUser) { return this.users.me(user.userId); }

  @Patch("me")
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiOperation({ summary: "Kullanıcı adı, görünen ad, bio ve stil seçimlerini güncelle" })
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProfileDto) { return this.users.updateProfile(user.userId, body); }

  @Get("me/private")
  @ApiOkResponse({ type: PrivateProfileResponseDto })
  @ApiOperation({ summary: "Yalnızca kendi isteğe bağlı demografik bilgilerin ve analiz iznin" })
  privateProfile(@CurrentUser() user: AuthenticatedUser) { return this.users.privateProfile(user.userId); }

  @Patch("me/private")
  @ApiOkResponse({ type: PrivateProfileResponseDto })
  updatePrivate(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePrivateProfileDto) { return this.users.updatePrivateProfile(user.userId, body); }

  @Get("me/settings")
  @ApiOkResponse({ type: SettingsResponseDto })
  settings(@CurrentUser() user: AuthenticatedUser) { return this.users.settings(user.userId); }

  @Patch("me/settings")
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiOperation({ summary: "Bildirim ve yeni paylaşım varsayılanları; mevcut paylaşımları değiştirmez" })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateSettingsDto) { return this.users.updateSettings(user.userId, body); }

  @Get("style-tags")
  @ApiOkResponse({ type: [StyleTagResponseDto] })
  styles() { return this.users.styleTags(); }

  @Get("users/username-availability")
  @ApiOkResponse({ type: UsernameAvailabilityResponseDto })
  username(@CurrentUser() user: AuthenticatedUser, @Query() query: UsernameQueryDto) { return this.users.usernameAvailability(user.userId, query.username); }

  @Get("users/:id")
  @ApiOkResponse({ type: PublicProfileResponseDto })
  @ApiOperation({ summary: "Aktif ve iki yönde de engellenmemiş kullanıcının kamusal profili" })
  profile(@CurrentUser() user: AuthenticatedUser, @Param() params: UserIdParamsDto) { return this.users.publicProfile(user.userId, params.id); }
}
