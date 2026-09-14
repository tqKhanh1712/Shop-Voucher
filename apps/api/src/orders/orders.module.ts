import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpiryProcessor } from './expiry.processor';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService, ExpiryProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
