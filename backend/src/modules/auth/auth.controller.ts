import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { ActionTokenDto, EmailDto, LoginDto, MockLoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from "./dto/auth.dto.js";
import { AuthRateGuard } from "./guards/auth-rate.guard.js";
import { AcceptedResponseDto, AuthMeResponseDto, AuthProvidersResponseDto, OkResponseDto, SessionResponseDto } from "./dto/auth-response.dto.js";

@ApiTags("auth")
@UseGuards(AuthRateGuard)
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get("providers")
  @ApiOkResponse({ type: AuthProvidersResponseDto })
  @ApiOperation({ summary: "Giriş yöntemleri ve gerçek/mock durumu" })
  providers() { return this.auth.providers(); }

  @Public()
  @Post("register")
  @HttpCode(202)
  @ApiAcceptedResponse({ type: AcceptedResponseDto })
  @ApiOperation({ summary: "E-posta/şifre ile kayıt; yerel doğrulama e-postası" })
  register(@Body() body: RegisterDto) { return this.auth.register(body); }

  @Public()
  @Post("login")
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: "Doğrulanmış e-posta/şifre ile oturum aç" })
  login(@Body() body: LoginDto) { return this.auth.login(body); }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: "Token çiftini döndür; eski refresh token tekrar kullanılamaz" })
  refresh(@Body() body: RefreshDto) { return this.auth.refresh(body.refreshToken); }

  @ApiBearerAuth()
  @Post("logout")
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  logout(@CurrentUser() user: AuthenticatedUser) { return this.auth.logout(user, false); }

  @ApiBearerAuth()
  @Post("logout-all")
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  logoutAll(@CurrentUser() user: AuthenticatedUser) { return this.auth.logout(user, true); }

  @ApiBearerAuth()
  @Get("me")
  @ApiOkResponse({ type: AuthMeResponseDto })
  me(@CurrentUser() user: AuthenticatedUser) { return this.auth.me(user); }

  @Public()
  @Post("email-verification/request")
  @HttpCode(202)
  @ApiAcceptedResponse({ type: AcceptedResponseDto })
  requestVerification(@Body() body: EmailDto) { return this.auth.requestAction(body.email, "VERIFY_EMAIL"); }

  @Public()
  @Post("email-verification/confirm")
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  verify(@Body() body: ActionTokenDto) { return this.auth.consumeAction(body.token, "VERIFY_EMAIL"); }

  @Public()
  @Post("password-reset/request")
  @HttpCode(202)
  @ApiAcceptedResponse({ type: AcceptedResponseDto })
  requestReset(@Body() body: EmailDto) { return this.auth.requestAction(body.email, "RESET_PASSWORD"); }

  @Public()
  @Post("password-reset/confirm")
  @HttpCode(200)
  @ApiOkResponse({ type: OkResponseDto })
  reset(@Body() body: ResetPasswordDto) { return this.auth.consumeAction(body.token, "RESET_PASSWORD", body.password); }

  @Public()
  @Post("mock")
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiOperation({ summary: "Yalnızca geliştirme: Google/Apple mock kimliğiyle giriş" })
  mock(@Body() body: MockLoginDto) { return this.auth.mockLogin(body); }
}
