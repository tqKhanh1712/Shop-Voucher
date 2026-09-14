import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { getJwtSecret } from '../jwt-secret';
import { AuthSessionService } from '../auth-session.service';

interface AccessTokenPayload {
  sub?: string;
  sid?: string;
  purpose?: string;
  iat?: number;
}

/**
 * Strategy giải mã và kiểm tra độ tin cậy của JWT được gửi kèm trong header Authorization Bearer.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authSessions: AuthSessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /**
   * Phương thức validate được gọi tự động sau khi token được giải mã thành công.
   * @param payload Dữ liệu chứa bên trong JWT (userId gán ở 'sub')
   * @returns Đối tượng User đã đăng nhập
   * @throws UnauthorizedException nếu không tìm thấy user hoặc tài khoản đã bị khóa (RB-08)
   */
  async validate(payload: AccessTokenPayload) {
    return this.authSessions.validateAccess(payload);
  }
}
