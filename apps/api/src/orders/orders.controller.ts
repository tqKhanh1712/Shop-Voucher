import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';

/**
 * Controller tiếp nhận REST API xử lý đơn đặt hàng của Khách hàng.
 * POST /orders, GET /orders, GET /orders/:id
 */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  /**
   * Đặt hàng (Checkout) tạo đơn hàng mới từ giỏ hàng hiện tại.
   * POST /orders
   */
  @Post()
  async checkout(@Req() req: any, @Body() checkoutDto: CheckoutDto) {
    return this.ordersService.checkout(req.user.userId, checkoutDto);
  }

  /**
   * Lấy lịch sử đơn hàng của khách hàng hiện tại.
   * GET /orders
   */
  @Get()
  async getCustomerOrders(@Req() req: any) {
    return this.ordersService.getCustomerOrders(req.user.userId);
  }

  /**
   * Xem chi tiết một đơn hàng cụ thể.
   * GET /orders/:id
   */
  @Get(':id')
  async getOrderDetails(@Req() req: any, @Param('id') orderId: string) {
    return this.ordersService.getOrderDetails(req.user.userId, orderId);
  }

  /**
   * Yêu cầu hủy và hoàn tiền đơn hàng.
   * POST /orders/:id/refund
   */
  @Post(':id/refund')
  async requestRefund(@Req() req: any, @Param('id') orderId: string) {
    return this.ordersService.requestRefund(req.user.userId, orderId);
  }

  /**
   * Admin: Xem danh sách tất cả các đơn đặt hàng trên hệ thống.
   * GET /orders/admin/list
   */
  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminListOrders(@Query() query: AdminOrderQueryDto) {
    return this.ordersService.adminListOrders(query);
  }

  /**
   * Admin: Chủ động hoàn tiền và hủy đơn hàng.
   * POST /orders/admin/:id/refund
   */
  @Post('admin/:id/refund')
  @Roles(UserRole.ADMIN)
  async adminRefundOrder(@Req() req: any, @Param('id') orderId: string) {
    return this.ordersService.adminRefundOrder(req.user.userId, orderId);
  }
}
