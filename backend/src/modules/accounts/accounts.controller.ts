import { Body, Controller, Delete, Get, HttpCode, Param, UseGuards } from "@nestjs/common";
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { AdminGuard } from "../auth/admin-access.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { UserIdParamsDto } from "../users/dto/users.dto.js";
import { AccountsService } from "./accounts.service.js";
import { AccountDeletionReceiptDto, AccountDeletionStatusDto, DeleteAccountDto } from "./dto/accounts.dto.js";

@Controller()
@ApiTags("accounts")
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Delete("me/account") @HttpCode(202) @ApiAcceptedResponse({ type: AccountDeletionReceiptDto })
  @ApiOperation({ summary: "Kendi hesabını kalıcı kapat; son 15 dakika içinde yeni giriş ve açık silme onayı gerekir" })
  remove(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto) { return this.accounts.requestDeletion(user, dto); }

  @Get("admin/users/:id/deletion") @UseGuards(AdminGuard) @ApiOkResponse({ type: AccountDeletionStatusDto })
  @ApiOperation({ summary: "Yalnız yöneticiye silme işinin durumu; özel temizlik hash'lerini açmaz" })
  status(@CurrentUser() user: AuthenticatedUser, @Param() params: UserIdParamsDto) { return this.accounts.status(user.userId, params.id); }
}
