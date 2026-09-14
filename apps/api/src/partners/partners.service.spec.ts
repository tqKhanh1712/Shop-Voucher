import { PartnersService } from './partners.service';

describe('PartnersService dashboard', () => {
  it('should return metrics scoped to the current partner account', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          partnerName: 'Cửa hàng A',
          totalCampaigns: 3n,
          activeCampaigns: 2n,
          soldVouchers: 20n,
          customerCount: 2n,
          revenue: 950000,
          usedVouchers: 4n,
        },
      ]),
    };

    const service = new PartnersService(prisma as any, {} as any);

    const result = await service.getDashboard('partner-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.totalCampaigns).toBe(3);
    expect(result.activeCampaigns).toBe(2);
    expect(result.soldVouchers).toBe(20);
    expect(result.customerCount).toBe(2);
    expect(result.revenue).toBe(950000);
    expect(result.usedVouchers).toBe(4);
    expect(result.partnerName).toBe('Cửa hàng A');
  });

  it('returns every voucher campaign status in the admin dashboard', async () => {
    const prisma = {
      partner: {
        count: jest.fn().mockResolvedValue(3),
      },
      voucherCampaign: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'APPROVED', _count: { _all: 35 } },
          { status: 'PENDING_APPROVAL', _count: { _all: 6 } },
          { status: 'DRAFT', _count: { _all: 5 } },
          { status: 'REJECTED', _count: { _all: 5 } },
          { status: 'EXPIRED', _count: { _all: 5 } },
          { status: 'PAUSED', _count: { _all: 4 } },
          { status: 'SOLD_OUT', _count: { _all: 5 } },
        ]),
      },
      order: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _count: 12, _sum: { totalAmount: 900000 } }),
      },
      user: {
        groupBy: jest.fn().mockResolvedValue([
          { role: 'CUSTOMER', _count: { _all: 20 } },
          { role: 'ADMIN', _count: { _all: 2 } },
          { role: 'PARTNER_STAFF', _count: { _all: 4 } },
        ]),
      },
    };
    const service = new PartnersService(prisma as any, {} as any);

    const result = await service.getAdminDashboard();

    expect(result.totalCampaigns).toBe(65);
    expect(result.campaignStats).toEqual({
      approved: 35,
      pending: 6,
      draft: 5,
      rejected: 5,
      expired: 5,
      paused: 4,
      soldOut: 5,
    });
    expect(prisma.voucherCampaign.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
  });
});

describe('PartnersService branches', () => {
  it('stores the normalized province code when creating a branch', async () => {
    const prisma = {
      branch: { create: jest.fn().mockResolvedValue({ branchId: 'branch-1' }) },
    };
    const service = new PartnersService(prisma as any, {} as any);

    await service.createBranch('partner-1', {
      name: 'Chi nhánh trung tâm',
      address: '123 Lê Lợi',
      provinceCode: '79',
    });

    expect(prisma.branch.create).toHaveBeenCalledWith({
      data: {
        partnerId: 'partner-1',
        name: 'Chi nhánh trung tâm',
        address: '123 Lê Lợi',
        provinceCode: '79',
      },
    });
  });
});

describe('PartnersService staff accounts', () => {
  it('normalizes a staff email before checking duplicates and persisting it', async () => {
    const prisma = {
      branch: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ branchId: 'branch-1', partnerId: 'partner-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ userId: 'staff-1' }),
      },
    };
    const service = new PartnersService(prisma as any, {} as any);

    await service.createStaff('partner-1', {
      email: ' StaffLocDemo@GMAIL.com ',
      phone: '0704946039',
      password: 'Password123',
      fullName: 'Staff Loc Demo',
      branchId: 'branch-1',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'stafflocdemo@gmail.com' },
      select: { userId: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'stafflocdemo@gmail.com' }),
      }),
    );
  });
});
