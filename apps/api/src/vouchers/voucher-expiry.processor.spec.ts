import { VoucherCodeStatus } from '@prisma/client';
import { VoucherExpiryProcessor } from './voucher-expiry.processor';

describe('VoucherExpiryProcessor', () => {
  it('expires both available and locked voucher codes', async () => {
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const processor = new VoucherExpiryProcessor({
      voucherCode: { updateMany },
    } as any);

    await processor.handleExpiredVoucherCodes();

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [VoucherCodeStatus.AVAILABLE, VoucherCodeStatus.LOCKED],
          },
        }),
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [VoucherCodeStatus.AVAILABLE, VoucherCodeStatus.LOCKED],
          },
        }),
      }),
    );
  });
});
