import { Controller, Get, Header, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { TrendsQueryDto } from "./dto/trends.dto.js";
import { TrendsPageDto } from "./dto/trends-response.dto.js";
import { TrendsService } from "./trends.service.js";

@ApiTags("Trends")
@ApiBearerAuth()
@Controller("trends")
export class TrendsController {
  constructor(private readonly service: TrendsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({
    summary:
      "Seçilen kombinlerdeki ürünler; hesap/ürün/gün tekil katkı, en az 5 ayrı hesap",
  })
  @ApiOkResponse({ type: TrendsPageDto })
  @ApiConflictResponse({
    description:
      "TREND_RESULTS_CHANGED veya TREND_PAGE_EXPIRED: ilk sayfadan yenileyin",
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: TrendsQueryDto) {
    return this.service.list(user.userId, query);
  }
}
