import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Controller tiếp nhận REST API quản lý giỏ hàng của Khách hàng.
 * POST /cart/items, GET /cart, PATCH /cart/items/:id, DELETE /cart/items/:id
 */
@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CartController {
  constructor(private cartService: CartService) {}

  /**
   * Xem giỏ hàng hiện tại của khách hàng đăng nhập.
   * GET /cart
   */
  @Get()
  async getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  /**
   * Thêm voucher vào giỏ hàng.
   * POST /cart/items
   */
  @Post('items')
  async addItem(@Req() req: any, @Body() addCartItemDto: AddCartItemDto) {
    return this.cartService.addItem(req.user.userId, addCartItemDto);
  }

  /**
   * Cập nhật số lượng vật phẩm trong giỏ hàng.
   * PATCH /cart/items/:id
   */
  @Patch('items/:id')
  async updateItem(
    @Req() req: any,
    @Param('id') cartItemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.userId, cartItemId, updateCartItemDto);
  }

  /**
   * Xóa vật phẩm khỏi giỏ hàng.
   * DELETE /cart/items/:id
   */
  @Delete('items/:id')
  async deleteItem(@Req() req: any, @Param('id') cartItemId: string) {
    return this.cartService.deleteItem(req.user.userId, cartItemId);
  }
}
