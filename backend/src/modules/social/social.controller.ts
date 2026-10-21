import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FriendRequestsQueryDto, SocialUserParamsDto, TargetUserDto, UserSearchQueryDto } from "./dto/social.dto.js";
import {
  BlockListResponseDto, BlockResponseDto, FollowListResponseDto, FollowResponseDto, RelationshipDetailResponseDto, RelationshipResponseDto,
  SocialListResponseDto,
} from "./dto/social-response.dto.js";
import { SocialService } from "./social.service.js";

@ApiTags("social")
@ApiBearerAuth()
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get("users/search")
  @ApiOkResponse({ type: SocialListResponseDto })
  @ApiOperation({ summary: "Kullanıcı adı başlangıcıyla aktif/engelsiz kullanıcıları ara" })
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: UserSearchQueryDto) { return this.social.search(user.userId, query); }

  @Get("users/:userId/relationship")
  @ApiOkResponse({ type: RelationshipDetailResponseDto })
  relationship(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.relationship(user.userId, params.userId); }

  @Get("me/friends")
  @ApiOkResponse({ type: SocialListResponseDto })
  friends(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) { return this.social.friends(user.userId, query); }

  @Get("me/friend-requests")
  @ApiOkResponse({ type: SocialListResponseDto })
  requests(@CurrentUser() user: AuthenticatedUser, @Query() query: FriendRequestsQueryDto) { return this.social.requests(user.userId, query); }

  @Post("friend-requests")
  @HttpCode(200)
  @ApiOkResponse({ type: RelationshipResponseDto })
  @ApiOperation({ summary: "İstek gönder; aynı istek tekrarını tekilleştir; karşı istek otomatik kabul değildir" })
  request(@CurrentUser() user: AuthenticatedUser, @Body() body: TargetUserDto) { return this.social.request(user.userId, body.targetUserId); }

  @Delete("friend-requests/:userId")
  @ApiOkResponse({ type: RelationshipResponseDto })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.cancel(user.userId, params.userId); }

  @Post("friend-requests/:userId/accept")
  @HttpCode(200)
  @ApiOkResponse({ type: RelationshipResponseDto })
  accept(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.accept(user.userId, params.userId); }

  @Post("friend-requests/:userId/decline")
  @HttpCode(200)
  @ApiOkResponse({ type: RelationshipResponseDto })
  decline(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.decline(user.userId, params.userId); }

  @Delete("friends/:userId")
  @ApiOkResponse({ type: RelationshipResponseDto })
  remove(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.removeFriend(user.userId, params.userId); }

  @Put("users/:userId/follow")
  @ApiOkResponse({ type: FollowResponseDto })
  @ApiOperation({ summary: "Takip et; onay gerektirmez, tekrar aynı sonucu döndürür. Arkadaşlık veya FRIENDS erişimi vermez" })
  follow(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.follow(user.userId, params.userId); }

  @Delete("users/:userId/follow")
  @ApiOkResponse({ type: FollowResponseDto })
  @ApiOperation({ summary: "Takibi bırak; takip yoksa da başarılıdır" })
  unfollow(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.unfollow(user.userId, params.userId); }

  @Get("users/:userId/followers")
  @ApiOkResponse({ type: FollowListResponseDto })
  @ApiOperation({ summary: "Takipçiler, yeniden eskiye; izleyiciyle engelli veya kapalı hesaplar listelenmez" })
  followers(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto, @Query() query: PageQueryDto) {
    return this.social.followers(user.userId, params.userId, query);
  }

  @Get("users/:userId/following")
  @ApiOkResponse({ type: FollowListResponseDto })
  @ApiOperation({ summary: "Takip edilenler, yeniden eskiye" })
  following(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto, @Query() query: PageQueryDto) {
    return this.social.following(user.userId, params.userId, query);
  }

  @Get("me/blocks")
  @ApiOkResponse({ type: BlockListResponseDto })
  blocks(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) { return this.social.blocks(user.userId, query); }

  @Put("blocks/:userId")
  @ApiOkResponse({ type: BlockResponseDto })
  @ApiOperation({ summary: "Engelle; arkadaşlığı ve bekleyen isteği aynı transaction'da kaldır" })
  block(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.block(user.userId, params.userId); }

  @Delete("blocks/:userId")
  @ApiOkResponse({ type: BlockResponseDto })
  @ApiOperation({ summary: "Kendi engelini kaldır; eski arkadaşlık geri gelmez" })
  unblock(@CurrentUser() user: AuthenticatedUser, @Param() params: SocialUserParamsDto) { return this.social.unblock(user.userId, params.userId); }
}
