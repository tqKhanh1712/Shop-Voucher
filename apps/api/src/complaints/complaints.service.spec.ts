import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ComplaintMessageVisibility,
  ComplaintStatus,
  ComplaintType,
  UserRole,
} from '@prisma/client';
import { ComplaintsService } from './complaints.service';

describe('ComplaintsService complaint integrity', () => {
  const customerId = '00000000-0000-4000-8000-000000000001';
  const complaintId = '00000000-0000-4000-8000-000000000002';
  const adminId = '00000000-0000-4000-8000-000000000003';
  const orderId = '00000000-0000-4000-8000-000000000004';
  const itemId = '00000000-0000-4000-8000-000000000005';
  const campaignId = '00000000-0000-4000-8000-000000000006';
  const partnerId = '00000000-0000-4000-8000-000000000007';
  const voucherCodeId = '00000000-0000-4000-8000-000000000008';

  function createContext() {
    const tx = {
      voucherCode: { findFirst: jest.fn() },
      orderItem: { findFirst: jest.fn() },
      voucherReview: { findFirst: jest.fn() },
      order: { findFirst: jest.fn() },
      complaint: {
        create: jest.fn().mockImplementation(({ data }) => ({
          complaintId,
          status: ComplaintStatus.OPEN,
          ...data,
        })),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ complaintId, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ complaintId }),
      },
      complaintMessage: { create: jest.fn() },
      complaintEvent: { create: jest.fn() },
      user: { findFirst: jest.fn() },
    };
    let transactionActive = false;
    const prisma = {
      complaint: tx.complaint,
      $transaction: jest.fn(async (callback) => {
        transactionActive = true;
        try {
          return await callback(tx);
        } finally {
          transactionActive = false;
        }
      }),
    };
    const audit = {
      logActivity: jest.fn().mockImplementation(async () => {
        expect(transactionActive).toBe(true);
      }),
    };
    const service = new ComplaintsService(prisma as any, audit as any);
    return { service, tx, audit };
  }

  it.each([
    ['order', { orderId }, 'order'],
    ['order item', { orderItemId: itemId }, 'orderItem'],
    ['voucher', { voucherCodeId }, 'voucherCode'],
    [
      'review',
      { reviewId: '00000000-0000-4000-8000-000000000009' },
      'voucherReview',
    ],
    ['campaign', { campaignId }, 'orderItem'],
  ])(
    'rejects a foreign %s reference',
    async (_label, reference, repository) => {
      const { service, tx } = createContext();
      (tx as Record<string, any>)[repository].findFirst.mockResolvedValue(null);

      await expect(
        service.create(customerId, {
          type: ComplaintType.VOUCHER,
          subject: 'Không sử dụng được voucher',
          description: 'Mã voucher báo lỗi.',
          ...reference,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.complaint.create).not.toHaveBeenCalled();
    },
  );

  it('derives the partner and purchase context from an owned voucher', async () => {
    const { service, tx, audit } = createContext();
    tx.voucherCode.findFirst.mockResolvedValue({
      codeId: voucherCodeId,
      itemId,
      orderItem: {
        orderId,
        campaignId,
        campaign: { partnerId },
      },
    });

    await service.create(customerId, {
      type: ComplaintType.VOUCHER,
      subject: '  Không sử dụng được voucher  ',
      description: '  Mã voucher báo lỗi.  ',
      voucherCodeId,
    });

    expect(tx.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId,
        voucherCodeId,
        orderItemId: itemId,
        orderId,
        campaignId,
        partnerId,
        subject: 'Không sử dụng được voucher',
        description: 'Mã voucher báo lỗi.',
      }),
    });
    expect(tx.complaintMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId,
        senderId: customerId,
        body: 'Mã voucher báo lỗi.',
      }),
    });
    expect(tx.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId,
        eventType: 'SUBMITTED',
        toStatus: ComplaintStatus.OPEN,
      }),
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: complaintId,
        actionType: 'CREATE_COMPLAINT',
      }),
      tx,
    );
  });

  it('rejects references that point to different purchases', async () => {
    const { service, tx } = createContext();
    tx.voucherCode.findFirst.mockResolvedValue({
      codeId: voucherCodeId,
      itemId,
      orderItem: { orderId, campaignId, campaign: { partnerId } },
    });
    tx.order.findFirst.mockResolvedValue({
      orderId: '00000000-0000-4000-8000-000000000099',
      orderItems: [],
    });

    await expect(
      service.create(customerId, {
        type: ComplaintType.VOUCHER,
        subject: 'Voucher lỗi',
        description: 'Không dùng được.',
        voucherCodeId,
        orderId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.complaint.create).not.toHaveBeenCalled();
  });

  it('keeps resolved fields empty for an in-progress admin response', async () => {
    const { service, tx, audit } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.IN_REVIEW,
      version: 1,
      priority: 'NORMAL',
      assignedAdminId: null,
      partnerId,
      partnerDueAt: null,
      customerDueAt: null,
      resolutionResponse: null,
      resolvedById: null,
      resolvedAt: null,
    });

    await service.replyComplaint(complaintId, adminId, {
      status: ComplaintStatus.WAITING_PARTNER,
      resolutionResponse: 'Đang chờ đối tác xác minh.',
    });

    expect(tx.complaint.updateMany).toHaveBeenCalledWith({
      where: { complaintId, version: 1, status: ComplaintStatus.IN_REVIEW },
      data: expect.objectContaining({
        status: ComplaintStatus.WAITING_PARTNER,
        assignedAdminId: adminId,
        resolvedById: null,
        resolvedAt: null,
        closedAt: null,
      }),
    });
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'ADMIN_MANAGE_COMPLAINT' }),
      tx,
    );
  });

  it('sets resolution fields and records timeline data for a terminal response', async () => {
    const { service, tx } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.IN_REVIEW,
      version: 1,
      priority: 'NORMAL',
      assignedAdminId: adminId,
      partnerId,
      partnerDueAt: null,
      customerDueAt: null,
      resolutionResponse: null,
      resolvedById: null,
      resolvedAt: null,
    });

    await service.replyComplaint(complaintId, adminId, {
      status: ComplaintStatus.RESOLVED,
      resolutionResponse: 'Đã hoàn tất xử lý.',
    });

    expect(tx.complaint.updateMany).toHaveBeenCalledWith({
      where: { complaintId, version: 1, status: ComplaintStatus.IN_REVIEW },
      data: expect.objectContaining({
        status: ComplaintStatus.RESOLVED,
        resolvedById: adminId,
        resolvedAt: expect.any(Date),
      }),
    });
    expect(tx.complaintMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderId: adminId,
        body: 'Đã hoàn tất xử lý.',
      }),
    });
    expect(tx.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: ComplaintStatus.IN_REVIEW,
        toStatus: ComplaintStatus.RESOLVED,
      }),
    });
  });

  it('limits partner detail to complaints owned by that partner', async () => {
    const { service, tx } = createContext();
    tx.complaint.findFirst.mockResolvedValue({ complaintId, partnerId });

    await service.findPartnerComplaintDetail(partnerId, complaintId);

    expect(tx.complaint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { complaintId, partnerId } }),
    );
    const include = tx.complaint.findFirst.mock.calls[0][0].include;
    expect(include.messages.where).toEqual({
      visibility: ComplaintMessageVisibility.ALL_PARTIES,
    });
  });

  it('accepts a partner response only while waiting for that partner', async () => {
    const { service, tx } = createContext();
    tx.complaint.findFirst.mockResolvedValue({
      complaintId,
      partnerId,
      status: ComplaintStatus.WAITING_PARTNER,
      version: 3,
      customerDueAt: null,
      partnerDueAt: new Date(),
    });

    await service.partnerReply(partnerId, complaintId, {
      body: 'Đối tác đã kiểm tra giao dịch.',
      expectedVersion: 3,
    });

    expect(tx.complaint.findFirst).toHaveBeenCalledWith({
      where: { complaintId, partnerId },
    });
    expect(tx.complaint.updateMany).toHaveBeenCalledWith({
      where: {
        complaintId,
        version: 3,
        status: ComplaintStatus.WAITING_PARTNER,
      },
      data: expect.objectContaining({
        status: ComplaintStatus.IN_REVIEW,
        partnerDueAt: null,
      }),
    });
    expect(tx.complaintMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderId: partnerId,
        senderRoleSnapshot: UserRole.PARTNER,
        visibility: ComplaintMessageVisibility.ALL_PARTIES,
      }),
    });
  });

  it('rejects a customer response when it is not the customer turn', async () => {
    const { service, tx } = createContext();
    tx.complaint.findFirst.mockResolvedValue({
      complaintId,
      customerId,
      status: ComplaintStatus.WAITING_PARTNER,
      version: 1,
    });

    await expect(
      service.customerReply(customerId, complaintId, { body: 'Bổ sung.' }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.complaint.updateMany).not.toHaveBeenCalled();
  });

  it('detects concurrent admin updates with optimistic locking', async () => {
    const { service, tx } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.IN_REVIEW,
      version: 4,
      priority: 'NORMAL',
      assignedAdminId: adminId,
      partnerId,
      partnerDueAt: null,
      customerDueAt: null,
      resolutionResponse: null,
      resolvedById: null,
      resolvedAt: null,
    });
    tx.complaint.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.adminManageComplaint(complaintId, adminId, {
        priority: 'HIGH',
        visibility: ComplaintMessageVisibility.ADMIN_ONLY,
        expectedVersion: 3,
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.complaintMessage.create).not.toHaveBeenCalled();
  });

  it('keeps closed complaints immutable', async () => {
    const { service, tx } = createContext();
    tx.complaint.findUnique.mockResolvedValue({
      complaintId,
      status: ComplaintStatus.CLOSED,
      version: 2,
    });

    await expect(
      service.adminManageComplaint(complaintId, adminId, {
        message: 'Thử cập nhật.',
        visibility: ComplaintMessageVisibility.ADMIN_ONLY,
        expectedVersion: 2,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.complaint.updateMany).not.toHaveBeenCalled();
  });
});
