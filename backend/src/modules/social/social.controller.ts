import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { PageQueryDto } from "../../common/pagination/page-query.dto.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FriendRequestsQueryDto, SocialUserParamsDto, TargetUserDto, UserSearchQueryDto } from "./dto/social.dto.js";
import { BlockListResponseDto, BlockResponseDto, RelationshipResponseDto, SocialListResponseDto } from "./dto/social-response.dto.js";
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
  @ApiOkResponse({ type: RelationshipResponseDto })
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
