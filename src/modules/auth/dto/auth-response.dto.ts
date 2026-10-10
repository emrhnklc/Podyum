import { ApiProperty } from "@nestjs/swagger";

export class AcceptedResponseDto {
  @ApiProperty({ enum: ["accepted"] })
  status!: "accepted";
}

export class OkResponseDto {
  @ApiProperty({ enum: ["ok"] })
  status!: "ok";
}

export class SessionResponseDto {
  @ApiProperty({ description: "Opaque token; JWT değildir. Güvenli cihaz deposunda saklanır." })
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ enum: ["Bearer"] })
  tokenType!: "Bearer";

  @ApiProperty({ type: String, format: "date-time" })
  accessExpiresAt!: Date;

  @ApiProperty({ type: String, format: "date-time" })
  refreshExpiresAt!: Date;

  @ApiProperty({ format: "uuid" })
  sessionId!: string;

  @ApiProperty()
  mock!: boolean;
}

class AuthUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  username!: string;
  @ApiProperty()
  displayName!: string;
  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}

class SessionSummaryDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty({ enum: ["email", "mock:google", "mock:apple"] })
  provider!: string;
  @ApiProperty()
  mock!: boolean;
}

export class AuthMeResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
  @ApiProperty({ type: SessionSummaryDto })
  session!: SessionSummaryDto;
  @ApiProperty()
  profileSetupRequired!: boolean;
}

class EmailProviderDto {
  @ApiProperty()
  available!: boolean;
  @ApiProperty({ enum: ["local-only"] })
  emailDelivery!: string;
}

class OAuthProviderDto {
  @ApiProperty()
  available!: boolean;
  @ApiProperty({ enum: ["mock", "unconfigured"] })
  mode!: string;
}

export class AuthProvidersResponseDto {
  @ApiProperty({ type: EmailProviderDto })
  emailPassword!: EmailProviderDto;
  @ApiProperty({ type: OAuthProviderDto })
  google!: OAuthProviderDto;
  @ApiProperty({ type: OAuthProviderDto })
  apple!: OAuthProviderDto;
}
