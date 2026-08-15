import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class TwoFactorVerifyDto {
  @ApiProperty({
    description: "Temporary token received after password login",
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  tempToken!: string;

  @ApiProperty({ description: "Code TOTP a 6 chiffres", example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: "Le code doit contenir exactement 6 chiffres",
  })
  code!: string;
}

export class TwoFactorCodeDto {
  @ApiProperty({ description: "Code TOTP a 6 chiffres", example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: "Le code doit contenir exactement 6 chiffres",
  })
  code!: string;
}

export class LoginDto {
  @ApiProperty({ example: "admin@mikrolan.net" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "SecurePass123!", minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: "admin@mikrolan.net" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ example: "admin@mikrolan.net" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: "Code OTP a 6 chiffres recu par email",
    example: "123456",
  })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;
}

export class SignupDto {
  @ApiProperty({ example: "Wifi Abidjan" })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  tenantName!: string;

  @ApiProperty({ example: "user@example.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  idToken!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nonce?: string;
}

export class UpdateMeDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string | null;
}

export class UpdateNotificationsDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class SetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class PushTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  token!: string;
}

export class DeleteAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  googleIdToken?: string;
}
