import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  assertTrustedBrowserOrigin,
  clearRefreshTokenCookie,
  getRefreshToken,
  setRefreshTokenCookie,
} from './auth-cookie';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AccessPrincipal } from './auth-session.service';
import {
  AccountVerificationRequestDto,
  VerifyAccountDto,
} from './dto/account-verification.dto';

const MINUTE_MS = 60_000;

/**
 * Controller tiếp nhận các yêu cầu REST API phục vụ cho việc xác thực tài khoản:
 * Đăng ký, Đăng nhập và Quay vòng tokens.
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  /**
   * Endpoint đăng ký tài khoản.
   * POST /auth/register
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 10 * MINUTE_MS } })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Endpoint đăng nhập. Trả về thông tin User kèm cặp Access Token và Refresh Token.
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request);
    const result = await this.authService.login(loginDto, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
    setRefreshTokenCookie(
      response,
      result.refreshToken,
      result.session.absoluteExpiresAt,
    );
    return {
      user: result.user,
      accessToken: result.accessToken,
      session: result.session,
    };
  }

  /**
   * Endpoint làm mới Access Token bằng Refresh Token.
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: MINUTE_MS } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request);
    const refreshToken = getRefreshToken(request);
    if (!refreshToken) {
      clearRefreshTokenCookie(response);
      throw new UnauthorizedException('Không tìm thấy phiên đăng nhập.');
    }

    try {
      const result = await this.authService.refresh(refreshToken);
      setRefreshTokenCookie(
        response,
        result.refreshToken,
        result.session.absoluteExpiresAt,
      );
      return {
        user: result.user,
        accessToken: result.accessToken,
        session: result.session,
      };
    } catch (error) {
      clearRefreshTokenCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request);
    await this.authService.logout(getRefreshToken(request));
    clearRefreshTokenCookie(response);
  }

  @Post('activity')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  activity(@Req() request: Request & { user: AccessPrincipal }) {
    return {
      idleExpiresAt: request.user.idleExpiresAt,
      absoluteExpiresAt: request.user.absoluteExpiresAt,
    };
  }

  /**
   * Endpoint gửi yêu cầu đặt lại mật khẩu.
   * POST /auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 15 * MINUTE_MS } })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  /**
   * Endpoint xác nhận đặt lại mật khẩu bằng token.
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE_MS } })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('request-account-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 10 * MINUTE_MS } })
  async requestAccountVerification(@Body() dto: AccountVerificationRequestDto) {
    return this.authService.requestAccountVerification(dto);
  }

  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  async verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyAccount(dto);
  }
}
