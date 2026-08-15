import {
  Controller,
  Post,
  Patch,
  Delete,
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
import { AuthTokens } from "./auth.types";
import { TwoFactorService } from "./two-factor.service";
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  DeleteAccountDto,
  GoogleLoginDto,
  LoginDto,
  PushTokenDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  SetPasswordDto,
  SignupDto,
  TwoFactorCodeDto,
  TwoFactorVerifyDto,
  UpdateMeDto,
  UpdateNotificationsDto,
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
  @ApiOperation({ summary: "Login" })
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    const result = await this.authService.login(dto, ipAddress, userAgent);
    if (result.requiresTwoFactor) return result;
    return toMobileTokens(result.tokens);
  }

  @Public()
  @Post("signup")
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Signup — creates a Tenant + OWNER account" })
  async signup(@Body() dto: SignupDto, @Req() req: FastifyRequest) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";
    const tokens = await this.authService.signup(dto, ipAddress, userAgent);
    return toMobileTokens(tokens);
  }

  @Public()
  @Post("google")
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "Google OAuth login/signup" })
  async google(@Body() dto: GoogleLoginDto, @Req() req: FastifyRequest) {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";
    const tokens = await this.authService.googleLogin(
      dto,
      ipAddress,
      userAgent,
    );
    return toMobileTokens(tokens);
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

    const tokens = await this.authService.refreshTokens(
      dto,
      ipAddress,
      userAgent,
    );
    return toMobileTokens(tokens);
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
  @ApiOperation({ summary: "Get current user + tenant + subscription" })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Patch("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user profile" })
  updateMe(@CurrentUser() user: JwtPayload, @Body() body: UpdateMeDto) {
    return this.authService.updateMe(user.sub, body);
  }

  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete own account (soft delete)" })
  deleteMe(@CurrentUser() user: JwtPayload, @Body() body: DeleteAccountDto) {
    return this.authService.deleteAccount(user.sub, body);
  }

  @Patch("me/notifications")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle push notifications" })
  updateNotifications(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateNotificationsDto,
  ) {
    return this.authService.updateNotifications(user.sub, body.enabled);
  }

  @Post("set-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set a password (Google-only accounts)" })
  setPassword(@CurrentUser() user: JwtPayload, @Body() body: SetPasswordDto) {
    return this.authService.setPassword(user.sub, body.password);
  }

  @Post("push-token")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Register a push notification token" })
  registerPushToken(
    @CurrentUser() user: JwtPayload,
    @Body() body: PushTokenDto,
  ) {
    return this.authService.registerPushToken(user.sub, body.token);
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke all sessions" })
  logoutAll(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutAllSessions(user.sub);
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.twoFactorService.verifyLogin(
      dto.tempToken,
      dto.code,
      ipAddress,
      userAgent,
    );
  }
}

function toMobileTokens(tokens: AuthTokens) {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.accessExpiresIn,
  };
}
