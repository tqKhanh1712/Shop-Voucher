import { join } from 'node:path';
import { PartnerApprovalStatus, Prisma, VoucherStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GIFTPOP_SOURCE, ImportReport, NormalizedDataset } from './catalog.types';
import { writeJson } from './csv-files';
import { validateNormalizedCatalog } from './catalog.validator';

const asBoolean = (value: string): boolean => value.toLowerCase() === 'true';
const compoundKey = (source: string, externalId: string): string => `${source}::${externalId}`;
const IMPORT_TRANSACTION_TIMEOUT_MS = 120_000;

async function resolveCatalogPartnerId(
  prisma: PrismaService,
  requestedPartnerId?: string,
): Promise<string> {
  if (requestedPartnerId) {
    const partner = await prisma.partner.findUnique({ where: { partnerId: requestedPartnerId } });
    if (!partner) throw new Error(`Catalog partner ${requestedPartnerId} does not exist.`);
    return partner.partnerId;
  }

  const existingCampaign = await prisma.voucherCampaign.findFirst({
    where: { externalSource: GIFTPOP_SOURCE },
    select: { partnerId: true },
  });
  if (existingCampaign) return existingCampaign.partnerId;

  const partner = await prisma.partner.findFirst({
    where: { approvalStatus: PartnerApprovalStatus.APPROVED },
    orderBy: { createdAt: 'asc' },
    select: { partnerId: true },
  });
  if (!partner) {
    throw new Error('No approved partner is available to own imported catalog campaigns.');
  }
  return partner.partnerId;
}

async function createPlan(
  prisma: PrismaService,
  dataset: NormalizedDataset,
): Promise<{ inserted: number; updated: number; unchanged: number }> {
  const existing = await prisma.voucherCampaign.findMany({
    where: {
      OR: dataset.campaigns.map((campaign) => ({
        externalSource: campaign.external_source,
        externalId: campaign.external_id,
      })),
    },
    select: { externalSource: true, externalId: true, sourceContentHash: true },
  });
  const existingByKey = new Map(
    existing.map((campaign) => [
      compoundKey(campaign.externalSource ?? '', campaign.externalId ?? ''),
      campaign.sourceContentHash,
    ]),
  );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const campaign of dataset.campaigns) {
    const existingHash = existingByKey.get(
      compoundKey(campaign.external_source, campaign.external_id),
    );
    if (existingHash === undefined) inserted += 1;
    else if (existingHash === campaign.source_content_hash) unchanged += 1;
    else updated += 1;
  }
  return { inserted, updated, unchanged };
}

async function upsertReferenceData(
  tx: Prisma.TransactionClient,
  dataset: NormalizedDataset,
  partnerId: string,
): Promise<{
  brandIds: Map<string, string>;
  categoryIds: Map<string, string>;
  branchIds: Map<string, string>;
}> {
  const categoryIds = new Map<string, string>();
  const sortedCategories = [...dataset.categories].sort((left, right) => {
    if (!left.parent_code && right.parent_code) return -1;
    if (left.parent_code && !right.parent_code) return 1;
    return Number(left.display_order) - Number(right.display_order);
  });

  for (const row of sortedCategories) {
    const parentId = row.parent_code ? categoryIds.get(row.parent_code) : null;
    if (row.parent_code && !parentId) {
      throw new Error(`Missing parent category ${row.parent_code} for ${row.code}.`);
    }
    const category = await tx.voucherCategory.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        nameVi: row.name_vi,
        parentId,
        externalSource: row.external_source || null,
        externalId: row.external_id || null,
        displayOrder: Number(row.display_order),
        isActive: asBoolean(row.is_active),
      },
      update: {
        nameVi: row.name_vi,
        parentId,
        externalSource: row.external_source || null,
        externalId: row.external_id || null,
        displayOrder: Number(row.display_order),
        isActive: asBoolean(row.is_active),
      },
      select: { categoryId: true },
    });
    categoryIds.set(row.code, category.categoryId);
  }

  const brandIds = new Map<string, string>();
  for (const row of dataset.brands) {
    const brand = await tx.catalogBrand.upsert({
      where: {
        externalSource_externalId: {
          externalSource: row.external_source,
          externalId: row.external_id,
        },
      },
      create: {
        displayName: row.display_name,
        logoUrl: row.logo_url || null,
        sourceUrl: row.source_url || null,
        externalSource: row.external_source,
        externalId: row.external_id,
        importedAt: new Date(row.crawled_at),
        lastSeenAt: new Date(row.crawled_at),
      },
      update: {
        displayName: row.display_name,
        logoUrl: row.logo_url || null,
        sourceUrl: row.source_url || null,
        lastSeenAt: new Date(row.crawled_at),
      },
      select: { brandId: true },
    });
    brandIds.set(compoundKey(row.external_source, row.external_id), brand.brandId);
  }

  const branchIds = new Map<string, string>();
  for (const row of dataset.branches) {
    const branch = await tx.branch.upsert({
      where: {
        externalSource_externalId: {
          externalSource: row.external_source,
          externalId: row.external_id,
        },
      },
      create: {
        partnerId,
        name: row.name,
        address: row.address,
        provinceCode: row.province_code || null,
        sourceUrl: row.source_url,
        externalSource: row.external_source,
        externalId: row.external_id,
        importedAt: new Date(row.crawled_at),
      },
      update: {
        name: row.name,
        address: row.address,
        provinceCode: row.province_code || null,
        sourceUrl: row.source_url,
      },
      select: { branchId: true },
    });
    branchIds.set(compoundKey(row.external_source, row.external_id), branch.branchId);
  }

  return { brandIds, categoryIds, branchIds };
}

async function applyDataset(
  prisma: PrismaService,
  dataset: NormalizedDataset,
  partnerId: string,
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const { brandIds, categoryIds, branchIds } = await upsertReferenceData(
        tx,
        dataset,
        partnerId,
      );

      for (const row of dataset.campaigns) {
        const existing = await tx.voucherCampaign.findUnique({
          where: {
            externalSource_externalId: {
              externalSource: row.external_source,
              externalId: row.external_id,
            },
          },
          select: { campaignId: true },
        });
        const sharedData = {
          title: row.title,
          description: row.description,
          termsAndConditions: row.terms_and_conditions,
          category: row.legacy_category_code,
          originalPrice: new Prisma.Decimal(row.original_price),
          salePrice: new Prisma.Decimal(row.sale_price),
          currency: row.currency,
          usageValidityDays: Number(row.usage_validity_days),
          thumbnailUrl: row.thumbnail_url,
          sourceUrl: row.source_url,
          externalSource: row.external_source,
          externalId: row.external_id,
          sourceContentHash: row.source_content_hash,
          lastSeenAt: new Date(row.crawled_at),
        };

        const campaign = existing
          ? await tx.voucherCampaign.update({
              where: { campaignId: existing.campaignId },
              data: sharedData,
              select: { campaignId: true },
            })
          : await tx.voucherCampaign.create({
              data: {
                ...sharedData,
                partnerId,
                saleStartTime: new Date(row.sale_start_time),
                saleEndTime: new Date(row.sale_end_time),
                usageStartTime: new Date(row.usage_start_time),
                usageEndTime: new Date(row.usage_end_time),
                capacity: Number(row.capacity),
                status: row.status as VoucherStatus,
                importedAt: new Date(row.crawled_at),
                isMultiUse: false,
              },
              select: { campaignId: true },
            });

        const campaignBrands = dataset.campaignBrands.filter(
          (relation) => relation.campaign_external_id === row.external_id,
        );
        const campaignCategories = dataset.campaignCategories.filter(
          (relation) => relation.campaign_external_id === row.external_id,
        );
        const campaignBranches = dataset.campaignBranches.filter(
          (relation) => relation.campaign_external_id === row.external_id,
        );

        await Promise.all([
          tx.campaignBrand.deleteMany({ where: { campaignId: campaign.campaignId } }),
          tx.campaignCategory.deleteMany({ where: { campaignId: campaign.campaignId } }),
          tx.campaignBranch.deleteMany({ where: { campaignId: campaign.campaignId } }),
        ]);

        await tx.campaignBrand.createMany({
          data: campaignBrands.map((relation) => ({
            campaignId: campaign.campaignId,
            brandId:
              brandIds.get(
                compoundKey(relation.brand_external_source, relation.brand_external_id),
              ) ?? (() => { throw new Error(`Missing brand ${relation.brand_external_id}`); })(),
            isPrimary: asBoolean(relation.is_primary),
          })),
        });
        await tx.campaignCategory.createMany({
          data: campaignCategories.map((relation) => ({
            campaignId: campaign.campaignId,
            categoryId:
              categoryIds.get(relation.category_code) ??
              (() => { throw new Error(`Missing category ${relation.category_code}`); })(),
            isPrimary: asBoolean(relation.is_primary),
          })),
        });
        if (campaignBranches.length > 0) {
          await tx.campaignBranch.createMany({
            data: campaignBranches.map((relation) => ({
              partnerId,
              campaignId: campaign.campaignId,
              branchId:
                branchIds.get(
                  compoundKey(relation.branch_external_source, relation.branch_external_id),
                ) ?? (() => { throw new Error(`Missing branch ${relation.branch_external_id}`); })(),
            })),
          });
        }
      }

      const cleanup = await tx.branch.deleteMany({
        where: {
          externalSource: GIFTPOP_SOURCE,
          campaignBranches: { none: {} },
          staff: { none: {} },
          voucherUsageLogs: { none: {} },
        },
      });

      return cleanup.count;
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
  );
}

export async function importCatalogCsv(options: {
  inputDirectory: string;
  apply: boolean;
  partnerId?: string;
}): Promise<ImportReport> {
  const validation = await validateNormalizedCatalog(options.inputDirectory);
  if (validation.issues.length > 0) {
    throw new Error(
      `Import refused because validation reported ${validation.issues.length} issue(s).`,
    );
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const partnerId = await resolveCatalogPartnerId(prisma, options.partnerId);
    const plan = await createPlan(prisma, validation.dataset);
    let orphanBranchesRemoved = 0;
    if (options.apply) {
      orphanBranchesRemoved = await applyDataset(prisma, validation.dataset, partnerId);
    }

    const report: ImportReport = {
      mode: options.apply ? 'apply' : 'dry-run',
      source: GIFTPOP_SOURCE,
      campaigns: {
        ...plan,
        rejected: validation.issues.length,
      },
      brands: validation.dataset.brands.length,
      categories: validation.dataset.categories.length,
      branches: validation.dataset.branches.length,
      orphanBranchesRemoved,
      completedAt: new Date().toISOString(),
    };
    await writeJson(join(options.inputDirectory, 'import-report.json'), report);
    return report;
  } finally {
    await prisma.onModuleDestroy();
  }
}
