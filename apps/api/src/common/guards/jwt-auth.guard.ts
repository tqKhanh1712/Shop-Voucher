import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard bảo vệ các route yêu cầu người dùng phải gửi mã JWT hợp lệ (Bearer Token).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
