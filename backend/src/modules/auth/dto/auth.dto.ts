import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsEmail, IsIn, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import { AUTH_RULES } from "../auth.constants.js";

export class EmailDto {
  @ApiProperty({ example: "elif@example.com", maxLength: 254 })
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ minLength: 15, maxLength: 128, format: "password" })
  @IsString()
  @MinLength(AUTH_RULES.passwordMinLength)
  @MaxLength(AUTH_RULES.passwordMaxLength)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ example: "elifyz", pattern: "^[a-z0-9_]{3,30}$" })
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @Matches(AUTH_RULES.usernamePattern)
  username!: string;

  @ApiProperty({ example: "Elif Yılmaz", minLength: 1, maxLength: 80 })
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  displayName!: string;
}

export class ActionTokenDto {
  @ApiProperty({ description: "Yerel posta kutusundaki tek kullanımlık token", minLength: 43, maxLength: 43 })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}

export class ResetPasswordDto extends ActionTokenDto {
  @ApiProperty({ minLength: 15, maxLength: 128, format: "password" })
  @IsString()
  @Length(15, 128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ minLength: 43, maxLength: 43 })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refreshToken!: string;
}

export class MockLoginDto {
  @ApiProperty({ enum: ["google", "apple"] })
  @IsIn(["google", "apple"])
  provider!: "google" | "apple";

  @ApiProperty({ example: "test-elif", description: "Mock kimlik; gerçek sağlayıcı token'ı değildir." })
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  subject!: string;

  @ApiProperty({ enum: [true], description: "İstemci mock giriş yaptığını açıkça kabul eder." })
  @Equals(true)
  acknowledgeMock!: true;
}
