/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ActivityCategory, UserRole } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma: any = {
    user: { findUnique: jest.fn() },
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma);
  });

  it('writes admin actions to the canonical activity log', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'admin',
      fullName: 'Admin A',
      email: 'a@example.com',
    });
    prisma.activityLog.create.mockResolvedValue({ activityId: 'activity-1' });
    await service.logAction('admin', 'UPDATE_USER', 'User', null);
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin',
        actorRoleSnapshot: UserRole.ADMIN,
        actorNameSnapshot: 'Admin A',
        category: ActivityCategory.ADMIN,
      }),
    });
  });

  it('redacts sensitive metadata recursively', async () => {
    prisma.user.findUnique.mockResolvedValue({
      fullName: 'Admin A',
      email: 'a@example.com',
      role: UserRole.ADMIN,
    });
    prisma.activityLog.create.mockResolvedValue({ activityId: 'activity-1' });
    await service.logActivity({
      actorUserId: 'admin',
      category: ActivityCategory.AUTH,
      actionType: 'LOGIN',
      targetEntity: 'Session',
      metadata: {
        token: 'secret',
        nested: { passwordHash: 'hash', safe: 'value' },
      },
    });
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          token: '[REDACTED]',
          nested: { passwordHash: '[REDACTED]', safe: 'value' },
        },
      }),
    });
  });

  it('returns a paginated activity log response', async () => {
    prisma.activityLog.findMany.mockReturnValue('items-query');
    prisma.activityLog.count.mockReturnValue('count-query');
    prisma.$transaction.mockResolvedValue([[{ activityId: 'a' }], 26]);
    const result = await service.getAdminLogs({
      page: 2,
      limit: 25,
      sort: 'desc',
    } as any);
    expect(result).toEqual(
      expect.objectContaining({ total: 26, page: 2, totalPages: 2 }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'items-query',
      'count-query',
    ]);
  });
});
