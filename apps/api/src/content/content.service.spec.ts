/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ActivityCategory, ContentStatus, ContentType } from '@prisma/client';
import { ContentService } from './content.service';

describe('ContentService', () => {
  const tx: any = { contentEntry: { create: jest.fn(), update: jest.fn() } };
  const prisma: any = {
    contentEntry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit: any = { logActivity: jest.fn() };
  let service: ContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (arg: any) =>
      typeof arg === 'function' ? arg(tx) : Promise.all(arg),
    );
    service = new ContentService(prisma, audit);
  });

  it('creates published content and records a content audit event in the transaction', async () => {
    prisma.contentEntry.findUnique.mockResolvedValue(null);
    tx.contentEntry.create.mockResolvedValue({
      contentId: 'content-1',
      title: 'Tin mới',
      status: ContentStatus.PUBLISHED,
    });
    await service.create(
      'admin-1',
      {
        type: ContentType.ARTICLE,
        slug: 'tin-moi',
        title: 'Tin mới',
        status: ContentStatus.PUBLISHED,
        displayOrder: 0,
      },
      {},
    );
    expect(tx.contentEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'tin-moi',
        publishedAt: expect.any(Date),
      }),
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        category: ActivityCategory.CONTENT,
        actionType: 'CREATE_CONTENT',
        targetId: 'content-1',
      }),
      tx,
    );
  });

  it('only exposes published content inside its display window', async () => {
    prisma.contentEntry.findMany.mockResolvedValue([]);
    await service.listPublic({ type: ContentType.BANNER, limit: 10 });
    expect(prisma.contentEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ContentStatus.PUBLISHED,
          type: ContentType.BANNER,
        }),
        take: 10,
      }),
    );
  });

  it('rejects an invalid publication window', async () => {
    prisma.contentEntry.findUnique.mockResolvedValue(null);
    await expect(
      service.create(
        'admin-1',
        {
          type: ContentType.POPUP,
          slug: 'popup',
          title: 'Popup',
          status: ContentStatus.DRAFT,
          displayOrder: 0,
          startsAt: '2026-08-28T00:00:00.000Z',
          endsAt: '2026-08-27T00:00:00.000Z',
        },
        {},
      ),
    ).rejects.toThrow('Thời gian kết thúc phải sau thời gian bắt đầu.');
  });
});
