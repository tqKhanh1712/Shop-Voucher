import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * Module quản lý tài khoản người dùng.
 * Cung cấp UsersService cho các phân hệ khác (như AuthModule) sử dụng.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
