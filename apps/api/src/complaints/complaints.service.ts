import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  ComplaintMessageVisibility,
  ComplaintStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ReplyComplaintDto } from './dto/reply-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { ComplaintMessageDto } from './dto/complaint-message.dto';
import { AdminManageComplaintDto } from './dto/admin-manage-complaint.dto';

type ComplaintContext = {
  orderId?: string;
  orderItemId?: string;
  voucherCodeId?: string;
  campaignId?: string;
  reviewId?: string;
  partnerId?: string;
};

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mergeContext(
    context: ComplaintContext,
    values: ComplaintContext,
    sourceLabel: string,
  ) {
    for (const [key, value] of Object.entries(values)) {
      if (!value) continue;
      const field = key as keyof ComplaintContext;
      if (context[field] && context[field] !== value) {
        throw new BadRequestException(
          `${sourceLabel} không khớp với các tham chiếu khác trong khiếu nại.`,
        );
      }
      context[field] = value;
    }
  }

  private async resolveComplaintContext(
    tx: Prisma.TransactionClient,
    customerId: string,
    dto: CreateComplaintDto,
  ): Promise<ComplaintContext> {
    const context: ComplaintContext = {};

    if (dto.voucherCodeId) {
      const voucher = await tx.voucherCode.findFirst({
        where: { codeId: dto.voucherCodeId, customerId },
        select: {
          codeId: true,
          itemId: true,
          orderItem: {
            select: {
              orderId: true,
              campaignId: true,
              campaign: { select: { partnerId: true } },
            },
          },
        },
      });
      if (!voucher) {
        throw new BadRequestException(
          'Voucher không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          voucherCodeId: voucher.codeId,
          orderItemId: voucher.itemId,
          orderId: voucher.orderItem.orderId,
          campaignId: voucher.orderItem.campaignId,
          partnerId: voucher.orderItem.campaign.partnerId,
        },
        'Voucher',
      );
    }

    if (dto.orderItemId) {
      const item = await tx.orderItem.findFirst({
        where: { itemId: dto.orderItemId, order: { customerId } },
        select: {
          itemId: true,
          orderId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
      });
      if (!item) {
        throw new BadRequestException(
          'Sản phẩm trong đơn không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          orderItemId: item.itemId,
          orderId: item.orderId,
          campaignId: item.campaignId,
          partnerId: item.campaign.partnerId,
        },
        'Sản phẩm trong đơn',
      );
    }

    if (dto.reviewId) {
      const review = await tx.voucherReview.findFirst({
        where: { reviewId: dto.reviewId, customerId },
        select: {
          reviewId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
      });
      if (!review) {
        throw new BadRequestException(
          'Đánh giá không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          reviewId: review.reviewId,
          campaignId: review.campaignId,
          partnerId: review.campaign.partnerId,
        },
        'Đánh giá',
      );
    }

    if (dto.orderId) {
      const order = await tx.order.findFirst({
        where: { orderId: dto.orderId, customerId },
        select: {
          orderId: true,
          orderItems: {
            select: {
              itemId: true,
              campaignId: true,
              campaign: { select: { partnerId: true } },
            },
          },
        },
      });
      if (!order) {
        throw new BadRequestException(
          'Đơn hàng không tồn tại hoặc không thuộc khách hàng.',
        );
      }
      this.mergeContext(context, { orderId: order.orderId }, 'Đơn hàng');

      if (context.campaignId) {
        const matchingItem = order.orderItems.find(
          (item) => item.campaignId === context.campaignId,
        );
        if (!matchingItem) {
          throw new BadRequestException(
            'Chiến dịch không thuộc đơn hàng đã chọn.',
          );
        }
        this.mergeContext(
          context,
          {
            orderItemId: matchingItem.itemId,
            campaignId: matchingItem.campaignId,
            partnerId: matchingItem.campaign.partnerId,
          },
          'Đơn hàng',
        );
      }
    }

    if (dto.campaignId) {
      const purchasedItem = await tx.orderItem.findFirst({
        where: {
          campaignId: dto.campaignId,
          order: {
            customerId,
            ...(context.orderId ? { orderId: context.orderId } : {}),
          },
        },
        select: {
          itemId: true,
          orderId: true,
          campaignId: true,
          campaign: { select: { partnerId: true } },
        },
        orderBy: { order: { createdAt: 'desc' } },
      });
      if (!purchasedItem) {
        throw new BadRequestException(
          'Chiến dịch không thuộc lịch sử mua hàng của khách hàng.',
        );
      }
      this.mergeContext(
        context,
        {
          campaignId: purchasedItem.campaignId,
          partnerId: purchasedItem.campaign.partnerId,
          ...(context.orderId
            ? {
                orderId: purchasedItem.orderId,
                orderItemId: purchasedItem.itemId,
              }
            : {}),
        },
        'Chiến dịch',
      );
    }

    return context;
  }

  async create(customerId: string, createDto: CreateComplaintDto) {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.resolveComplaintContext(
        tx,
        customerId,
        createDto,
      );
      const complaint = await tx.complaint.create({
        data: {
          customerId,
          type: createDto.type,
          subject: createDto.subject.trim(),
          description: createDto.description.trim(),
          ...context,
        },
      });

      await tx.complaintMessage.create({
        data: {
          complaintId: complaint.complaintId,
          senderId: customerId,
          senderRoleSnapshot: UserRole.CUSTOMER,
          visibility: ComplaintMessageVisibility.ALL_PARTIES,
          body: complaint.description,
        },
      });
      await tx.complaintEvent.create({
        data: {
          complaintId: complaint.complaintId,
          actorId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          eventType: 'SUBMITTED',
          toStatus: ComplaintStatus.OPEN,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          category: ActivityCategory.SUPPORT,
          actionType: 'CREATE_COMPLAINT',
          targetEntity: 'Complaint',
          targetId: complaint.complaintId,
          metadata: {
            type: complaint.type,
            partnerId: complaint.partnerId ?? null,
          },
        },
        tx,
      );

      return complaint;
    });
  }

  private buildListWhere(
    query: ComplaintQueryDto,
    scope: Prisma.ComplaintWhereInput,
  ) {
    const where: Prisma.ComplaintWhereInput = {
      ...scope,
      status: query.status,
      priority: query.priority,
      // A tenant scope must always win over a user-supplied filter.
      partnerId: scope.partnerId ?? query.partnerId,
      assignedAdminId: query.assignedAdminId,
      OR: query.keyword
        ? [
            { subject: { contains: query.keyword, mode: 'insensitive' } },
            {
              customer: {
                fullName: { contains: query.keyword, mode: 'insensitive' },
              },
            },
            {
              customer: {
                email: { contains: query.keyword, mode: 'insensitive' },
              },
            },
            {
              order: {
                orderCode: { contains: query.keyword, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
      AND: query.overdue
        ? [
            {
              OR: [
                {
                  status: ComplaintStatus.WAITING_PARTNER,
                  partnerDueAt: { lt: new Date() },
                },
                {
                  status: ComplaintStatus.WAITING_CUSTOMER,
                  customerDueAt: { lt: new Date() },
                },
              ],
            },
          ]
        : undefined,
    };
    return where;
  }

  private async pagedList(
    where: Prisma.ComplaintWhereInput,
    query: ComplaintQueryDto,
  ) {
    const include = {
      customer: { select: { email: true, fullName: true, phone: true } },
      campaign: { select: { title: true } },
      order: { select: { orderCode: true } },
      partner: { select: { companyName: true } },
      assignedAdmin: { select: { email: true, fullName: true } },
      _count: { select: { messages: true } },
    } satisfies Prisma.ComplaintInclude;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        include,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findCustomerComplaints(customerId: string, query: ComplaintQueryDto) {
    return this.pagedList(this.buildListWhere(query, { customerId }), query);
  }

  /**
   * Lấy các vụ việc mà đối tác đăng nhập là bên liên quan.
   * @param partnerId ID đối tác đăng nhập.
   * @param query Bộ lọc trạng thái, quá hạn và phân trang.
   * @returns Danh sách khiếu nại trong phạm vi đối tác.
   */
  async findPartnerComplaints(partnerId: string, query: ComplaintQueryDto) {
    return this.pagedList(this.buildListWhere(query, { partnerId }), query);
  }

  private publicDetailInclude() {
    return {
      customer: { select: { fullName: true } },
      campaign: { select: { title: true } },
      order: { select: { orderCode: true } },
      partner: { select: { companyName: true } },
      assignedAdmin: { select: { fullName: true } },
      messages: {
        where: { visibility: ComplaintMessageVisibility.ALL_PARTIES },
        orderBy: { createdAt: 'asc' as const },
        include: { sender: { select: { fullName: true } } },
      },
      events: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          eventId: true,
          eventType: true,
          fromStatus: true,
          toStatus: true,
          actorRoleSnapshot: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.ComplaintInclude;
  }

  async findCustomerComplaintDetail(customerId: string, complaintId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { complaintId, customerId },
      include: this.publicDetailInclude(),
    });
    if (!complaint)
      throw new NotFoundException('Không tìm thấy khiếu nại này.');
    return complaint;
  }

  /**
   * Đọc chi tiết, hội thoại và lịch sử của một vụ việc thuộc đối tác.
   * @throws NotFoundException nếu vụ việc không thuộc đối tác.
   */
  async findPartnerComplaintDetail(partnerId: string, complaintId: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { complaintId, partnerId },
      include: this.publicDetailInclude(),
    });
    if (!complaint)
      throw new NotFoundException('Không tìm thấy khiếu nại thuộc đối tác.');
    return complaint;
  }

  async findAllAdmin(query: ComplaintQueryDto) {
    return this.pagedList(this.buildListWhere(query, {}), query);
  }

  async findOneAdmin(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
      include: {
        customer: { select: { email: true, fullName: true, phone: true } },
        resolvedBy: { select: { email: true, fullName: true } },
        assignedAdmin: { select: { email: true, fullName: true } },
        partner: { select: { companyName: true } },
        campaign: {
          select: { title: true, partner: { select: { companyName: true } } },
        },
        order: { select: { orderCode: true, totalAmount: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { fullName: true } } },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }
    return complaint;
  }

  private assertAdminTransition(from: ComplaintStatus, to: ComplaintStatus) {
    const transitions: Record<ComplaintStatus, ComplaintStatus[]> = {
      OPEN: [ComplaintStatus.IN_REVIEW, ComplaintStatus.REJECTED],
      IN_REVIEW: [
        ComplaintStatus.WAITING_PARTNER,
        ComplaintStatus.WAITING_CUSTOMER,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ],
      WAITING_PARTNER: [
        ComplaintStatus.IN_REVIEW,
        ComplaintStatus.WAITING_CUSTOMER,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ],
      WAITING_CUSTOMER: [
        ComplaintStatus.IN_REVIEW,
        ComplaintStatus.WAITING_PARTNER,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ],
      RESOLVED: [ComplaintStatus.CLOSED, ComplaintStatus.IN_REVIEW],
      REJECTED: [ComplaintStatus.CLOSED, ComplaintStatus.IN_REVIEW],
      CLOSED: [],
    };
    if (from !== to && !transitions[from].includes(to)) {
      throw new BadRequestException(
        `Không thể chuyển khiếu nại từ ${from} sang ${to}.`,
      );
    }
  }

  private responseDeadline(kind: 'partner' | 'customer') {
    const raw =
      kind === 'partner'
        ? process.env.COMPLAINT_PARTNER_RESPONSE_HOURS
        : process.env.COMPLAINT_CUSTOMER_RESPONSE_HOURS;
    const hours = Math.max(1, Number(raw) || 48);
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  async customerReply(
    customerId: string,
    complaintId: string,
    dto: ComplaintMessageDto,
  ) {
    return this.partyReply(UserRole.CUSTOMER, customerId, complaintId, dto);
  }

  /**
   * Nhận phản hồi của đối tác rồi ủy quyền xử lý transaction cho partyReply.
   * @throws BadRequestException nếu chưa đến lượt đối tác phản hồi.
   * @throws ConflictException nếu khiếu nại vừa bị cập nhật bởi người khác.
   */
  async partnerReply(
    partnerId: string,
    complaintId: string,
    dto: ComplaintMessageDto,
  ) {
    return this.partyReply(UserRole.PARTNER, partnerId, complaintId, dto);
  }

  /**
   * Transaction kiểm tra quyền/trạng thái/phiên bản, lưu tin nhắn và nhật ký thay đổi.
   * expectedVersion bảo vệ thao tác phản hồi đồng thời trên cùng một khiếu nại.
   */
  private async partyReply(
    role: UserRole,
    actorId: string,
    complaintId: string,
    dto: ComplaintMessageDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findFirst({
        where:
          role === UserRole.CUSTOMER
            ? { complaintId, customerId: actorId }
            : { complaintId, partnerId: actorId },
      });
      if (!complaint)
        throw new NotFoundException(
          'Không tìm thấy khiếu nại trong phạm vi tài khoản.',
        );
      const requiredStatus =
        role === UserRole.CUSTOMER
          ? ComplaintStatus.WAITING_CUSTOMER
          : ComplaintStatus.WAITING_PARTNER;
      if (complaint.status !== requiredStatus)
        throw new BadRequestException(
          'Hiện tại chưa đến lượt tài khoản này phản hồi.',
        );
      const expectedVersion = dto.expectedVersion ?? complaint.version;
      const updatedCount = await tx.complaint.updateMany({
        where: {
          complaintId,
          version: expectedVersion,
          status: requiredStatus,
        },
        data: {
          status: ComplaintStatus.IN_REVIEW,
          customerDueAt:
            role === UserRole.CUSTOMER ? null : complaint.customerDueAt,
          partnerDueAt:
            role === UserRole.PARTNER ? null : complaint.partnerDueAt,
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1)
        throw new ConflictException(
          'Khiếu nại vừa được cập nhật. Vui lòng tải lại.',
        );
      await tx.complaintMessage.create({
        data: {
          complaintId,
          senderId: actorId,
          senderRoleSnapshot: role,
          visibility: ComplaintMessageVisibility.ALL_PARTIES,
          body: dto.body.trim(),
        },
      });
      await tx.complaintEvent.create({
        data: {
          complaintId,
          actorId,
          actorRoleSnapshot: role,
          eventType: `${role}_REPLY`,
          fromStatus: requiredStatus,
          toStatus: ComplaintStatus.IN_REVIEW,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: actorId,
          actorRoleSnapshot: role,
          category: ActivityCategory.SUPPORT,
          actionType: `${role}_REPLY_COMPLAINT`,
          targetEntity: 'Complaint',
          targetId: complaintId,
        },
        tx,
      );
      return tx.complaint.findUniqueOrThrow({ where: { complaintId } });
    });
  }

  async customerTransition(
    customerId: string,
    complaintId: string,
    target: ComplaintStatus,
    expectedVersion: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findFirst({
        where: { complaintId, customerId },
      });
      if (!complaint)
        throw new NotFoundException('Không tìm thấy khiếu nại này.');
      const allowedStatuses: ComplaintStatus[] = [
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ];
      const customerTargets: ComplaintStatus[] = [
        ComplaintStatus.CLOSED,
        ComplaintStatus.IN_REVIEW,
      ];
      const allowed = allowedStatuses.includes(complaint.status);
      if (!allowed || !customerTargets.includes(target)) {
        throw new BadRequestException(
          'Thao tác không hợp lệ với trạng thái hiện tại.',
        );
      }
      const now = new Date();
      const result = await tx.complaint.updateMany({
        where: {
          complaintId,
          customerId,
          version: expectedVersion,
          status: complaint.status,
        },
        data:
          target === ComplaintStatus.CLOSED
            ? { status: target, closedAt: now, version: { increment: 1 } }
            : {
                status: target,
                resolutionResponse: null,
                resolvedById: null,
                resolvedAt: null,
                closedAt: null,
                version: { increment: 1 },
              },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Khiếu nại vừa được cập nhật. Vui lòng tải lại.',
        );
      await tx.complaintEvent.create({
        data: {
          complaintId,
          actorId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          eventType:
            target === ComplaintStatus.CLOSED
              ? 'CUSTOMER_CLOSED'
              : 'CUSTOMER_REOPENED',
          fromStatus: complaint.status,
          toStatus: target,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: customerId,
          actorRoleSnapshot: UserRole.CUSTOMER,
          category: ActivityCategory.SUPPORT,
          actionType:
            target === ComplaintStatus.CLOSED
              ? 'CLOSE_COMPLAINT'
              : 'REOPEN_COMPLAINT',
          targetEntity: 'Complaint',
          targetId: complaintId,
        },
        tx,
      );
      return tx.complaint.findUniqueOrThrow({ where: { complaintId } });
    });
  }

  async adminManageComplaint(
    complaintId: string,
    adminId: string,
    dto: AdminManageComplaintDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findUnique({
        where: { complaintId },
      });
      if (!complaint) throw new NotFoundException('Không tìm thấy khiếu nại.');
      if (complaint.status === ComplaintStatus.CLOSED)
        throw new BadRequestException('Khiếu nại đã đóng.');
      const targetStatus = dto.status ?? complaint.status;
      this.assertAdminTransition(complaint.status, targetStatus);
      const message = dto.message?.trim();
      const statusesRequiringMessage: ComplaintStatus[] = [
        ComplaintStatus.WAITING_PARTNER,
        ComplaintStatus.WAITING_CUSTOMER,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ];
      if (
        statusesRequiringMessage.includes(targetStatus) &&
        targetStatus !== complaint.status &&
        !message
      ) {
        throw new BadRequestException(
          'Cần nhập nội dung giải thích khi chuyển trạng thái này.',
        );
      }
      if (
        targetStatus === ComplaintStatus.WAITING_PARTNER &&
        !complaint.partnerId
      ) {
        throw new BadRequestException(
          'Khiếu nại chưa xác định được đối tác phụ trách.',
        );
      }
      if (dto.assignedAdminId) {
        const assignee = await tx.user.findFirst({
          where: { userId: dto.assignedAdminId, role: UserRole.ADMIN },
          select: { userId: true },
        });
        if (!assignee)
          throw new BadRequestException('Admin được phân công không hợp lệ.');
      }
      const now = new Date();
      const transitioned = targetStatus !== complaint.status;
      const resolutionStatuses: ComplaintStatus[] = [
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
      ];
      const resolutionStatus = resolutionStatuses.includes(targetStatus);
      const closedStatus = targetStatus === ComplaintStatus.CLOSED;
      const result = await tx.complaint.updateMany({
        where: {
          complaintId,
          version: dto.expectedVersion,
          status: complaint.status,
        },
        data: {
          status: targetStatus,
          priority: dto.priority,
          assignedAdminId:
            dto.assignedAdminId !== undefined
              ? dto.assignedAdminId
              : (complaint.assignedAdminId ?? adminId),
          partnerDueAt:
            targetStatus === ComplaintStatus.WAITING_PARTNER
              ? transitioned
                ? this.responseDeadline('partner')
                : complaint.partnerDueAt
              : null,
          customerDueAt:
            targetStatus === ComplaintStatus.WAITING_CUSTOMER
              ? transitioned
                ? this.responseDeadline('customer')
                : complaint.customerDueAt
              : null,
          resolutionResponse: resolutionStatus
            ? transitioned &&
              dto.visibility === ComplaintMessageVisibility.ALL_PARTIES &&
              message
              ? message
              : complaint.resolutionResponse
            : closedStatus
              ? complaint.resolutionResponse
              : null,
          resolvedById: resolutionStatus
            ? transitioned
              ? adminId
              : complaint.resolvedById
            : closedStatus
              ? complaint.resolvedById
              : null,
          resolvedAt: resolutionStatus
            ? transitioned
              ? now
              : complaint.resolvedAt
            : closedStatus
              ? complaint.resolvedAt
              : null,
          closedAt: closedStatus ? now : null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Khiếu nại vừa được Admin khác cập nhật. Vui lòng tải lại.',
        );
      if (message) {
        await tx.complaintMessage.create({
          data: {
            complaintId,
            senderId: adminId,
            senderRoleSnapshot: UserRole.ADMIN,
            visibility: dto.visibility,
            body: message,
          },
        });
      }
      await tx.complaintEvent.create({
        data: {
          complaintId,
          actorId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          eventType: message
            ? dto.visibility === ComplaintMessageVisibility.ADMIN_ONLY
              ? 'ADMIN_INTERNAL_NOTE'
              : 'ADMIN_REPLY'
            : 'ADMIN_UPDATED',
          fromStatus: complaint.status,
          toStatus: targetStatus,
          metadata: {
            priority: dto.priority ?? complaint.priority,
            assignedAdminId:
              dto.assignedAdminId ?? complaint.assignedAdminId ?? adminId,
          },
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.SUPPORT,
          actionType: 'ADMIN_MANAGE_COMPLAINT',
          targetEntity: 'Complaint',
          targetId: complaintId,
          metadata: {
            fromStatus: complaint.status,
            toStatus: targetStatus,
            visibility: dto.visibility,
          },
        },
        tx,
      );
      return tx.complaint.findUniqueOrThrow({ where: { complaintId } });
    });
  }

  async replyComplaint(
    complaintId: string,
    adminId: string,
    replyDto: ReplyComplaintDto,
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { complaintId },
      select: { version: true },
    });
    if (!complaint) throw new NotFoundException('Không tìm thấy khiếu nại.');
    return this.adminManageComplaint(complaintId, adminId, {
      status: replyDto.status,
      message: replyDto.resolutionResponse,
      visibility: ComplaintMessageVisibility.ALL_PARTIES,
      expectedVersion: complaint.version,
    });
  }
}
