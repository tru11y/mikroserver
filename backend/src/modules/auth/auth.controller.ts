import {
  Controller,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  TwoFactorCodeDto,
  TwoFactorVerifyDto,
  UpdateProfileDto,
} from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "./interfaces/jwt-payload.interface";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60000, limit: 10 } }) // 10 attempts/min per IP
  @ApiOperation({ summary: "Admin login" })
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: FastifyRequest) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    return this.authService.refreshTokens(dto, ipAddress, userAgent);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and revoke refresh token" })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RefreshTokenDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress = req.ip ?? "unknown";
    await this.authService.logout(user.sub, dto.refreshToken, ipAddress);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change password (invalidates all sessions)" })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress = req.ip ?? "unknown";
    await this.authService.changePassword(user.sub, dto, ipAddress);
  }

  @Public()
  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 3600000, limit: 5 } }) // 5 attempts/hour per IP
  @ApiOperation({ summary: "Request a password reset email with OTP code" })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    return this.authService.requestPasswordReset(dto, ipAddress, userAgent);
  }

  @Public()
  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm password reset with token + OTP code" })
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    return this.authService.confirmPasswordReset(dto, ipAddress, userAgent);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  @Patch("profile")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user email" })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.sub, body.email);
  }

  // ---------------------------------------------------------------------------
  // 2FA endpoints
  // ---------------------------------------------------------------------------

  @Post("2fa/setup")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Generate a TOTP secret + QR code for 2FA setup" })
  async twoFaSetup(@CurrentUser() user: JwtPayload) {
    return this.twoFactorService.setup(user.sub);
  }

  @Post("2fa/verify-setup")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Confirm TOTP code and activate 2FA" })
  async twoFaVerifySetup(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    return this.twoFactorService.verifySetup(user.sub, dto.code, ipAddress);
  }

  @Post("2fa/disable")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Disable 2FA (requires valid TOTP code)" })
  async twoFaDisable(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    return this.twoFactorService.disable(user.sub, dto.code, ipAddress);
  }

  @Public()
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify TOTP code after password login (returns full JWT)",
  })
  async twoFaVerify(
    @Body() dto: TwoFactorVerifyDto,
    @Req() req: FastifyRequest,
  ) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";
    return this.twoFactorService.verifyLogin(
      dto.tempToken,
      dto.code,
      ipAddress,
      userAgent,
    );
  }
}
