import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { getJwtSecret } from './jwt-secret';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import { AuthSessionService } from './auth-session.service';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth-session.constants';
import { AccountVerificationDeliveryService } from './account-verification-delivery.service';

/**
 * Module quản lý toàn bộ các cấu hình xác thực JWT, Passport và kết nối UsersModule.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    JwtStrategy,
    PasswordResetDeliveryService,
    AccountVerificationDeliveryService,
  ],
  exports: [AuthService, AuthSessionService],
})
export class AuthModule {}
