import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { VoucherStatus } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy toàn bộ danh sách vật phẩm trong giỏ hàng của khách hàng.
   * @param customerId ID khách hàng
   * @returns Danh sách CartItem kèm thông tin chi tiết VoucherCampaign
   */
  async getCart(customerId: string) {
    return this.prisma.cartItem.findMany({
      where: { customerId },
      include: {
        campaign: {
          include: {
            partner: {
              select: { companyName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Thêm voucher vào giỏ hàng hoặc tăng số lượng nếu đã tồn tại.
   * @param customerId ID khách hàng
   * @param dto DTO thêm vật phẩm
   * @returns Bản ghi CartItem vừa tạo hoặc cập nhật
   */
  async addItem(customerId: string, dto: AddCartItemDto) {
    const { campaignId, quantity = 1 } = dto;

    // Bước 1: Kiểm tra chiến dịch voucher có tồn tại không
    const campaign = await this.prisma.voucherCampaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Không tìm thấy chiến dịch voucher.');
    }

    // Bước 2: Ràng buộc trạng thái mở bán (Voucher phải ở trạng thái APPROVED)
    if (campaign.status !== VoucherStatus.APPROVED) {
      throw new BadRequestException('Voucher này hiện không được mở bán công khai.');
    }

    // Bước 3: Ràng buộc thời gian mở bán
    const now = new Date();
    if (now < campaign.saleStartTime || now > campaign.saleEndTime) {
      throw new BadRequestException('Chiến dịch voucher đã kết thúc hoặc chưa đến thời gian mở bán.');
    }

    // Bước 4: Kiểm tra tồn kho (soft check tại thời điểm thêm vào giỏ)
    const remaining = campaign.capacity - campaign.soldQuantity;
    if (remaining <= 0) {
      throw new BadRequestException('Voucher này đã bán hết hàng.');
    }

    // Bước 5: Kiểm tra xem vật phẩm đã có trong giỏ hàng chưa
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        customerId_campaignId: {
          customerId,
          campaignId,
        },
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > Math.min(remaining, 10)) {
        throw new BadRequestException(`Bạn chỉ có thể mua tối đa ${Math.min(remaining, 10)} voucher này.`);
      }

      return this.prisma.cartItem.update({
        where: { cartItemId: existingItem.cartItemId },
        data: { quantity: newQty },
      });
    }

    // Nếu chưa có, tạo mới cart item
    if (quantity > Math.min(remaining, 10)) {
      throw new BadRequestException(`Bạn chỉ có thể mua tối đa ${Math.min(remaining, 10)} voucher này.`);
    }

    return this.prisma.cartItem.create({
      data: {
        customerId,
        campaignId,
        quantity,
      },
    });
  }

  /**
   * Cập nhật số lượng của một vật phẩm cụ thể trong giỏ hàng.
   * @param customerId ID khách hàng sở hữu
   * @param cartItemId ID dòng vật phẩm trong giỏ hàng
   * @param dto DTO cập nhật số lượng
   */
  async updateItem(customerId: string, cartItemId: string, dto: UpdateCartItemDto) {
    const { quantity } = dto;

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cartItemId },
      include: { campaign: true },
    });

    if (!cartItem) {
      throw new NotFoundException('Không tìm thấy vật phẩm trong giỏ hàng.');
    }

    if (cartItem.customerId !== customerId) {
      throw new BadRequestException('Bạn không có quyền thao tác trên giỏ hàng này.');
    }

    // Kiểm tra tồn kho thực tế của voucher
    const remaining = cartItem.campaign.capacity - cartItem.campaign.soldQuantity;
    if (quantity > Math.min(remaining, 10)) {
      throw new BadRequestException(`Bạn chỉ có thể chọn tối đa ${Math.min(remaining, 10)} voucher này.`);
    }

    return this.prisma.cartItem.update({
      where: { cartItemId },
      data: { quantity },
    });
  }

  /**
   * Xóa một vật phẩm khỏi giỏ hàng.
   * @param customerId ID khách hàng sở hữu
   * @param cartItemId ID dòng vật phẩm cần xóa
   */
  async deleteItem(customerId: string, cartItemId: string) {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { cartItemId },
    });

    if (!cartItem) {
      throw new NotFoundException('Không tìm thấy vật phẩm trong giỏ hàng.');
    }

    if (cartItem.customerId !== customerId) {
      throw new BadRequestException('Bạn không có quyền thao tác trên giỏ hàng này.');
    }

    return this.prisma.cartItem.delete({
      where: { cartItemId },
    });
  }

  /**
   * Xóa toàn bộ giỏ hàng của khách hàng (sau khi checkout thành công).
   * @param customerId ID khách hàng
   */
  async clearCart(customerId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { customerId },
    });
  }
}
