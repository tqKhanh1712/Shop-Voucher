import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  GIFTPOP_CATEGORIES,
  GIFTPOP_SOURCE,
  PARENT_CATEGORIES,
} from './catalog.types';
import { readCsv, writeCsv, writeJson } from './csv-files';
import { inferProvinceCode } from '../common/constants/vietnam-provinces';

const splitIds = (value: string): string[] =>
  value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

const addDays = (value: Date, days: number): Date =>
  new Date(value.getTime() + days * 24 * 60 * 60 * 1000);

const DEMO_SALE_START = new Date('2026-09-01T00:00:00+07:00');
const DEMO_SALE_START_DAY_COUNT = 11;
const DEMO_USAGE_VALIDITY_DAYS = [7, 30, 45] as const;

export const createDemoCampaignSchedule = (
  externalId: string,
): { saleStart: Date; saleEnd: Date; usageValidityDays: number } => {
  const seed = createHash('sha256').update(`catalog-schedule:${externalId}`).digest();
  const saleStart = addDays(
    DEMO_SALE_START,
    seed.readUInt16BE(0) % DEMO_SALE_START_DAY_COUNT,
  );
  const saleEnd = addDays(saleStart, 365);
  const usageValidityDays =
    DEMO_USAGE_VALIDITY_DAYS[seed.readUInt16BE(2) % DEMO_USAGE_VALIDITY_DAYS.length];

  return { saleStart, saleEnd, usageValidityDays };
};

const contentHash = (row: Record<string, string>): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        title: row.title,
        description: row.description,
        termsAndConditions: row.terms_and_conditions,
        originalPrice: row.original_price,
        salePrice: row.sale_price,
        thumbnailUrl: row.thumbnail_url,
        usageValidityDays: row.usage_validity_days,
        brands: row.brand_external_ids,
        categories: row.category_external_ids,
        branches: row.branch_external_ids,
      }),
    )
    .digest('hex');

export async function normalizeCatalogCsv(inputDirectory: string): Promise<void> {
  const rawDirectory = join(inputDirectory, 'raw');
  const normalizedDirectory = join(inputDirectory, 'normalized');
  const [products, brands, branches] = await Promise.all([
    readCsv(join(rawDirectory, 'products.csv')),
    readCsv(join(rawDirectory, 'brands.csv')),
    readCsv(join(rawDirectory, 'branches.csv')),
  ]);

  const categoryIds = new Set<string>();
  for (const product of products) {
    for (const categoryId of splitIds(product.category_external_ids)) {
      categoryIds.add(categoryId);
    }
  }

  const categoryRows: Array<Record<string, unknown>> = PARENT_CATEGORIES.map((category) => ({
    code: category.code,
    name_vi: category.nameVi,
    parent_code: '',
    external_source: '',
    external_id: '',
    display_order: category.displayOrder,
    is_active: 'true',
  }));

  for (const externalId of categoryIds) {
    const category = GIFTPOP_CATEGORIES[externalId];
    const fallback = GIFTPOP_CATEGORIES.A102;
    const resolved = category ?? {
      nameVi: `Danh mục ${externalId}`,
      parentCode: 'OTHER' as const,
      displayOrder: 999,
    };
    categoryRows.push({
      code: `${GIFTPOP_SOURCE.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${externalId}`,
      name_vi: resolved.nameVi || fallback.nameVi,
      parent_code: resolved.parentCode,
      external_source: GIFTPOP_SOURCE,
      external_id: externalId,
      display_order: resolved.displayOrder,
      is_active: 'true',
    });
  }

  const branchRows = branches.map((branch) => ({
    ...branch,
    province_code: inferProvinceCode(branch.address) ?? '',
  }));

  const campaignRows = products.map((product) => {
    const { saleStart, saleEnd, usageValidityDays } = createDemoCampaignSchedule(
      product.external_id,
    );
    const primaryCategoryId = splitIds(product.category_external_ids)[0];
    const legacyCategoryCode =
      GIFTPOP_CATEGORIES[primaryCategoryId]?.parentCode ?? 'OTHER';

    return {
      external_source: product.external_source,
      external_id: product.external_id,
      title: product.title,
      description: product.description,
      terms_and_conditions: product.terms_and_conditions,
      legacy_category_code: legacyCategoryCode,
      original_price: product.original_price,
      sale_price: product.sale_price,
      currency: product.currency,
      thumbnail_url: product.thumbnail_url,
      source_url: product.source_url,
      usage_validity_days: usageValidityDays,
      sale_start_time: saleStart.toISOString(),
      sale_end_time: saleEnd.toISOString(),
      usage_start_time: saleStart.toISOString(),
      usage_end_time: addDays(saleEnd, usageValidityDays).toISOString(),
      capacity: 100,
      status: 'APPROVED',
      source_content_hash: contentHash(product),
      crawled_at: product.crawled_at,
    };
  });

  const campaignBrandRows = products.flatMap((product) =>
    splitIds(product.brand_external_ids).map((brandId, index) => ({
      campaign_external_source: product.external_source,
      campaign_external_id: product.external_id,
      brand_external_source: GIFTPOP_SOURCE,
      brand_external_id: brandId,
      is_primary: index === 0 ? 'true' : 'false',
    })),
  );
  const campaignCategoryRows = products.flatMap((product) =>
    splitIds(product.category_external_ids).map((categoryId, index) => ({
      campaign_external_source: product.external_source,
      campaign_external_id: product.external_id,
      category_code: `${GIFTPOP_SOURCE.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${categoryId}`,
      is_primary: index === 0 ? 'true' : 'false',
    })),
  );
  const campaignBranchRows = products.flatMap((product) =>
    splitIds(product.branch_external_ids).map((branchId) => ({
      campaign_external_source: product.external_source,
      campaign_external_id: product.external_id,
      branch_external_source: GIFTPOP_SOURCE,
      branch_external_id: branchId,
    })),
  );

  await Promise.all([
    writeCsv(
      join(normalizedDirectory, 'campaigns.csv'),
      [
        'external_source',
        'external_id',
        'title',
        'description',
        'terms_and_conditions',
        'legacy_category_code',
        'original_price',
        'sale_price',
        'currency',
        'thumbnail_url',
        'source_url',
        'usage_validity_days',
        'sale_start_time',
        'sale_end_time',
        'usage_start_time',
        'usage_end_time',
        'capacity',
        'status',
        'source_content_hash',
        'crawled_at',
      ],
      campaignRows,
    ),
    writeCsv(
      join(normalizedDirectory, 'brands.csv'),
      ['external_source', 'external_id', 'display_name', 'logo_url', 'source_url', 'crawled_at'],
      brands,
    ),
    writeCsv(
      join(normalizedDirectory, 'categories.csv'),
      [
        'code',
        'name_vi',
        'parent_code',
        'external_source',
        'external_id',
        'display_order',
        'is_active',
      ],
      categoryRows,
    ),
    writeCsv(
      join(normalizedDirectory, 'branches.csv'),
      [
        'external_source',
        'external_id',
        'brand_external_id',
        'name',
        'address',
        'province_code',
        'source_url',
        'crawled_at',
      ],
      branchRows,
    ),
    writeCsv(
      join(normalizedDirectory, 'campaign_brands.csv'),
      [
        'campaign_external_source',
        'campaign_external_id',
        'brand_external_source',
        'brand_external_id',
        'is_primary',
      ],
      campaignBrandRows,
    ),
    writeCsv(
      join(normalizedDirectory, 'campaign_categories.csv'),
      [
        'campaign_external_source',
        'campaign_external_id',
        'category_code',
        'is_primary',
      ],
      campaignCategoryRows,
    ),
    writeCsv(
      join(normalizedDirectory, 'campaign_branches.csv'),
      [
        'campaign_external_source',
        'campaign_external_id',
        'branch_external_source',
        'branch_external_id',
      ],
      campaignBranchRows,
    ),
  ]);

  await writeJson(join(inputDirectory, 'normalization-report.json'), {
    normalizedAt: new Date().toISOString(),
    campaigns: campaignRows.length,
    brands: brands.length,
    categories: categoryRows.length,
    branches: branches.length,
    campaignBrands: campaignBrandRows.length,
    campaignCategories: campaignCategoryRows.length,
    campaignBranches: campaignBranchRows.length,
  });
}
