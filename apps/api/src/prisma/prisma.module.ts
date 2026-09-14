import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Module toàn cục (Global) chứa kết nối cơ sở dữ liệu PrismaService.
 * Giúp các module khác có thể sử dụng trực tiếp PrismaService mà không cần import lại PrismaModule.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
