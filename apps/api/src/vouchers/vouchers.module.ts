import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VoucherExpiryProcessor } from './voucher-expiry.processor';
import { SearchService } from './search/search.service';
import { SearchRepository } from './search/search.repository';
import { QueryPreprocessor } from './search/query-preprocessor';
import { EmbeddingService } from './search/embedding.service';

/**
 * Module kết nối VouchersController và VouchersService phục vụ cho việc tạo lập/xét duyệt chiến dịch.
 */
@Module({
  imports: [PrismaModule],
  controllers: [VouchersController],
  providers: [
    VouchersService, 
    VoucherExpiryProcessor,
    SearchService,
    SearchRepository,
    QueryPreprocessor,
    EmbeddingService
  ],
  exports: [VouchersService, SearchService, EmbeddingService],
})
export class VouchersModule {}
