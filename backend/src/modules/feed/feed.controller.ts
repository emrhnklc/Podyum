import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FeedQueryDto, FeedResponseDto } from "./dto/feed.dto.js";
import { FeedService } from "./feed.service.js";

@ApiTags("feed")
@ApiBearerAuth()
@Controller("feed")
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @ApiOkResponse({ type: FeedResponseDto })
  @ApiOperation({ summary: "Herkes/arkadaşlar; açık, henüz oy vermediğin erişilebilir paylaşımlar. publishedAt/id azalan cursor." })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: FeedQueryDto) {
    return this.feed.list(user.userId, query);
  }
}
