import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  ContentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ContentQueryDto,
  PublicContentQueryDto,
} from './dto/content-query.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';

type RequestContext = { ipAddress?: string | null; userAgent?: string | null };

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private validateWindow(startsAt?: Date | null, endsAt?: Date | null) {
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu.',
      );
    }
  }

  private jsonSnapshot(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async listAdmin(query: ContentQueryDto) {
    const where: Prisma.ContentEntryWhereInput = {
      type: query.type,
      status: query.status,
      OR: query.keyword
        ? [
            { title: { contains: query.keyword, mode: 'insensitive' } },
            { slug: { contains: query.keyword, mode: 'insensitive' } },
            { summary: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentEntry.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { displayOrder: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.contentEntry.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  listPublic(query: PublicContentQueryDto) {
    const now = new Date();
    return this.prisma.contentEntry.findMany({
      where: {
        type: query.type,
        status: ContentStatus.PUBLISHED,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { publishedAt: 'desc' }],
      take: query.limit,
      select: {
        contentId: true,
        type: true,
        slug: true,
        title: true,
        summary: true,
        body: true,
        imageUrl: true,
        linkUrl: true,
        displayOrder: true,
        publishedAt: true,
        startsAt: true,
        endsAt: true,
      },
    });
  }

  async getPublicBySlug(slug: string) {
    const now = new Date();
    const content = await this.prisma.contentEntry.findFirst({
      where: {
        slug,
        status: ContentStatus.PUBLISHED,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
    });
    if (!content)
      throw new NotFoundException(
        'Nội dung không tồn tại hoặc chưa được xuất bản.',
      );
    return content;
  }

  async create(
    adminId: string,
    dto: CreateContentDto,
    context: RequestContext,
  ) {
    const slug = dto.slug.trim().toLowerCase();
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateWindow(startsAt, endsAt);

    const duplicate = await this.prisma.contentEntry.findUnique({
      where: { slug },
    });
    if (duplicate) throw new ConflictException('Slug nội dung đã tồn tại.');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.contentEntry.create({
        data: {
          type: dto.type,
          slug,
          title: dto.title.trim(),
          summary: dto.summary?.trim() || null,
          body: dto.body?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          linkUrl: dto.linkUrl?.trim() || null,
          status: dto.status,
          displayOrder: dto.displayOrder,
          publishedAt:
            dto.status === ContentStatus.PUBLISHED ? new Date() : null,
          startsAt,
          endsAt,
          createdById: adminId,
          updatedById: adminId,
        },
      });
      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.CONTENT,
          actionType: 'CREATE_CONTENT',
          targetEntity: 'ContentEntry',
          targetId: created.contentId,
          metadata: { after: this.jsonSnapshot(created) },
          ...context,
        },
        tx,
      );
      return created;
    });
  }

  async update(
    adminId: string,
    contentId: string,
    dto: UpdateContentDto,
    context: RequestContext,
  ) {
    const current = await this.prisma.contentEntry.findUnique({
      where: { contentId },
    });
    if (!current) throw new NotFoundException('Không tìm thấy nội dung.');

    const slug = dto.slug?.trim().toLowerCase();
    if (slug && slug !== current.slug) {
      const duplicate = await this.prisma.contentEntry.findUnique({
        where: { slug },
      });
      if (duplicate) throw new ConflictException('Slug nội dung đã tồn tại.');
    }
    const startsAt =
      dto.startsAt !== undefined
        ? dto.startsAt
          ? new Date(dto.startsAt)
          : null
        : current.startsAt;
    const endsAt =
      dto.endsAt !== undefined
        ? dto.endsAt
          ? new Date(dto.endsAt)
          : null
        : current.endsAt;
    this.validateWindow(startsAt, endsAt);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contentEntry.update({
        where: { contentId },
        data: {
          type: dto.type,
          slug,
          title: dto.title?.trim(),
          summary:
            dto.summary !== undefined ? dto.summary?.trim() || null : undefined,
          body: dto.body !== undefined ? dto.body?.trim() || null : undefined,
          imageUrl:
            dto.imageUrl !== undefined
              ? dto.imageUrl?.trim() || null
              : undefined,
          linkUrl:
            dto.linkUrl !== undefined ? dto.linkUrl?.trim() || null : undefined,
          status: dto.status,
          displayOrder: dto.displayOrder,
          startsAt,
          endsAt,
          publishedAt:
            dto.status === ContentStatus.PUBLISHED &&
            current.status !== ContentStatus.PUBLISHED
              ? new Date()
              : undefined,
          updatedById: adminId,
        },
      });
      const actionType =
        dto.status === ContentStatus.PUBLISHED
          ? 'PUBLISH_CONTENT'
          : dto.status === ContentStatus.ARCHIVED
            ? 'ARCHIVE_CONTENT'
            : current.status === ContentStatus.PUBLISHED &&
                dto.status === ContentStatus.DRAFT
              ? 'UNPUBLISH_CONTENT'
              : 'UPDATE_CONTENT';
      await this.auditService.logActivity(
        {
          actorUserId: adminId,
          actorRoleSnapshot: UserRole.ADMIN,
          category: ActivityCategory.CONTENT,
          actionType,
          targetEntity: 'ContentEntry',
          targetId: contentId,
          metadata: {
            before: this.jsonSnapshot(current),
            after: this.jsonSnapshot(updated),
          },
          ...context,
        },
        tx,
      );
      return updated;
    });
  }
}
