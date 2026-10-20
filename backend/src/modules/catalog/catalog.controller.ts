import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { AdminGuard } from "../auth/admin-access.service.js";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CatalogService } from "./catalog.service.js";
import {
  AdminCatalogQueryDto,
  CatalogAliasDto,
  CatalogIdDto,
  CatalogMergeDto,
  CatalogProductCreateDto,
  CatalogProductUpdateDto,
  CatalogQueryDto,
  CatalogResolveDto,
  CatalogStoreCreateDto,
  CatalogStoreUpdateDto,
  CatalogSuggestionCreateDto,
  CatalogSuggestionDecisionDto,
  SuggestionQueryDto,
} from "./dto/catalog.dto.js";
import {
  CatalogMergeResultDto,
  CatalogProductDto,
  CatalogProductPageDto,
  CatalogResolveResultDto,
  CatalogStoreAdminDto,
  CatalogStoresDto,
  CatalogSuggestionDto,
  CatalogSuggestionPageDto,
} from "./dto/catalog-response.dto.js";
const keyHeader = () =>
  ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "8–100 karakter; aynı başarılı komut tekrarını tekilleştirir.",
  });
@ApiTags("Catalog")
@ApiBearerAuth()
@Controller("catalog")
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get("stores") @ApiOkResponse({ type: CatalogStoresDto }) stores() {
    return this.service.stores();
  }
  @Get("products") @ApiOkResponse({ type: CatalogProductPageDto }) products(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogQueryDto,
  ) {
    return this.service.products(user.userId, query);
  }
  @Get("products/:id") @ApiOkResponse({ type: CatalogProductDto }) product(
    @Param() params: CatalogIdDto,
  ) {
    return this.service.product(params.id);
  }
  @Post("resolve")
  @HttpCode(200)
  @ApiOkResponse({ type: CatalogResolveResultDto })
  @ApiOperation({
    summary:
      "Link/isim çözümleme; ağdan sayfa almaz, isim yalnız aday üretir, veri yazmaz",
  })
  resolve(@Body() dto: CatalogResolveDto) {
    return this.service.resolve(dto);
  }
  @Get("suggestions")
  @ApiOkResponse({ type: CatalogSuggestionPageDto })
  suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionQueryDto,
  ) {
    return this.service.suggestions(user.userId, query);
  }
  @Get("suggestions/:id")
  @ApiOkResponse({ type: CatalogSuggestionDto })
  suggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
  ) {
    return this.service.suggestion(user.userId, params.id);
  }
  @Post("suggestions")
  @keyHeader()
  @ApiCreatedResponse({ type: CatalogSuggestionDto })
  @ApiOperation({
    summary: "Kullanıcının özel ürün önerisi; ortak ürün yaratmaz/düzeltmez",
  })
  suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CatalogSuggestionCreateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.createSuggestion(user.userId, dto, key);
  }
}
@ApiTags("Catalog management")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin/catalog")
export class CatalogAdminController {
  constructor(private readonly service: CatalogService) {}
  @Get("stores") @ApiOkResponse({ type: CatalogStoresDto }) stores() {
    return this.service.stores(true);
  }
  @Post("stores")
  @keyHeader()
  @ApiCreatedResponse({ type: CatalogStoreAdminDto })
  storeCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CatalogStoreCreateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.createStore(user.userId, dto, key);
  }
  @Put("stores/:id")
  @keyHeader()
  @ApiOkResponse({ type: CatalogStoreAdminDto })
  storeUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
    @Body() dto: CatalogStoreUpdateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.updateStore(user.userId, params.id, dto, key);
  }
  @Get("products") @ApiOkResponse({ type: CatalogProductPageDto }) products(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminCatalogQueryDto,
  ) {
    return this.service.products(user.userId, query, true);
  }
  @Get("products/:id") @ApiOkResponse({ type: CatalogProductDto }) product(
    @Param() params: CatalogIdDto,
  ) {
    return this.service.product(params.id, true);
  }
  @Post("products")
  @keyHeader()
  @ApiCreatedResponse({ type: CatalogProductDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CatalogProductCreateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.createProduct(user.userId, dto, key);
  }
  @Put("products/:id")
  @keyHeader()
  @ApiOkResponse({ type: CatalogProductDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
    @Body() dto: CatalogProductUpdateDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.updateProduct(user.userId, params.id, dto, key);
  }
  @Post("products/:id/urls")
  @HttpCode(200)
  @keyHeader()
  @ApiOkResponse({ type: CatalogProductDto })
  alias(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
    @Body() dto: CatalogAliasDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.addAlias(user.userId, params.id, dto, key);
  }
  @Post("products/:id/merge")
  @HttpCode(200)
  @keyHeader()
  @ApiOkResponse({ type: CatalogMergeResultDto })
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
    @Body() dto: CatalogMergeDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.merge(user.userId, params.id, dto, key);
  }
  @Get("suggestions")
  @ApiOkResponse({ type: CatalogSuggestionPageDto })
  suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionQueryDto,
  ) {
    return this.service.suggestions(user.userId, query, true);
  }
  @Put("suggestions/:id/decision")
  @keyHeader()
  @ApiOkResponse({ type: CatalogSuggestionDto })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CatalogIdDto,
    @Body() dto: CatalogSuggestionDecisionDto,
    @Headers("idempotency-key") key: unknown,
  ) {
    return this.service.decide(user.userId, params.id, dto, key);
  }
}
