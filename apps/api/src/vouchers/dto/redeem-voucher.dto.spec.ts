import { validate } from 'class-validator';
import { RedeemVoucherDto } from './redeem-voucher.dto';

describe('RedeemVoucherDto legacy code compatibility', () => {
  const branchId = '11111111-1111-4111-8111-111111111111';

  async function validateCode(uniqueCode: string) {
    const dto = new RedeemVoucherDto();
    dto.uniqueCode = uniqueCode;
    dto.branchId = branchId;
    return validate(dto);
  }

  it('accepts a legacy voucher code longer than the 12-character issuance format', async () => {
    await expect(validateCode('DEMO-001-20260828')).resolves.toHaveLength(0);
  });

  it('rejects voucher codes beyond the database-compatible 64-character limit', async () => {
    const errors = await validateCode('A'.repeat(65));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'uniqueCode',
          constraints: expect.objectContaining({
            maxLength: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
