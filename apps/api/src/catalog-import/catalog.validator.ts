import { join } from 'node:path';
import { readCsv, writeCsv, writeJson } from './csv-files';
import {
  CsvRow,
  NormalizedDataset,
  ValidationIssue,
  ValidationResult,
} from './catalog.types';
import { VIETNAM_PROVINCE_CODES } from '../common/constants/vietnam-provinces';

const keyOf = (...parts: string[]): string => parts.join('::');
const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const isGiftpopUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'giftpop.vn' || hostname.endsWith('.giftpop.vn');
  } catch {
    return false;
  }
};

const duplicateValues = (values: string[]): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
};

export async function loadNormalizedDataset(inputDirectory: string): Promise<NormalizedDataset> {
  const directory = join(inputDirectory, 'normalized');
  const [
    campaigns,
    brands,
    categories,
    branches,
    campaignBrands,
    campaignCategories,
    campaignBranches,
  ] = await Promise.all([
    readCsv(join(directory, 'campaigns.csv')),
    readCsv(join(directory, 'brands.csv')),
    readCsv(join(directory, 'categories.csv')),
    readCsv(join(directory, 'branches.csv')),
    readCsv(join(directory, 'campaign_brands.csv')),
    readCsv(join(directory, 'campaign_categories.csv')),
    readCsv(join(directory, 'campaign_branches.csv')),
  ]);

  return {
    campaigns,
    brands,
    categories,
    branches,
    campaignBrands,
    campaignCategories,
    campaignBranches,
  };
}

function validateCampaign(row: CsvRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reject = (errorCode: string, errorMessage: string): void => {
    issues.push({ externalId: row.external_id || '(missing)', errorCode, errorMessage });
  };

  if (!row.external_source || !row.external_id || !row.title.trim()) {
    reject('REQUIRED_FIELD', 'Thiếu external_source, external_id hoặc title.');
  }
  if (!isGiftpopUrl(row.source_url)) {
    reject('INVALID_SOURCE_URL', 'source_url phải thuộc giftpop.vn và dùng URL hợp lệ.');
  }
  if (!isHttpsUrl(row.thumbnail_url)) {
    reject('INVALID_THUMBNAIL_URL', 'thumbnail_url phải dùng HTTPS.');
  }
  if (!row.description.trim() || !row.terms_and_conditions.trim()) {
    reject('MISSING_SOURCE_CONTENT', 'Thiếu Thông tin sản phẩm hoặc Chú ý từ trang nguồn.');
  }
  if (/<\/?[a-z][\s\S]*>/i.test(row.description + row.terms_and_conditions)) {
    reject('HTML_NOT_SANITIZED', 'Description hoặc terms vẫn chứa HTML.');
  }

  const originalPrice = Number(row.original_price);
  const salePrice = Number(row.sale_price);
  if (!Number.isInteger(originalPrice) || originalPrice <= 0) {
    reject('INVALID_ORIGINAL_PRICE', 'original_price phải là số nguyên VND lớn hơn 0.');
  }
  if (!Number.isInteger(salePrice) || salePrice <= 0 || salePrice >= originalPrice) {
    reject('INVALID_SALE_PRICE', 'sale_price phải lớn hơn 0 và luôn nhỏ hơn original_price.');
  }
  if (row.currency !== 'VND') {
    reject('INVALID_CURRENCY', 'Catalog Giftpop demo chỉ chấp nhận VND.');
  }

  const usageValidityDays = Number(row.usage_validity_days);
  const capacity = Number(row.capacity);
  if (!Number.isInteger(usageValidityDays) || usageValidityDays <= 0) {
    reject('INVALID_VALIDITY', 'usage_validity_days phải là số nguyên dương.');
  }
  if (!Number.isInteger(capacity) || capacity <= 0) {
    reject('INVALID_CAPACITY', 'capacity phải là số nguyên dương.');
  }

  const saleStart = new Date(row.sale_start_time);
  const saleEnd = new Date(row.sale_end_time);
  const usageStart = new Date(row.usage_start_time);
  const usageEnd = new Date(row.usage_end_time);
  if (
    [saleStart, saleEnd, usageStart, usageEnd].some((date) => Number.isNaN(date.getTime())) ||
    saleStart >= saleEnd ||
    usageStart >= usageEnd ||
    saleEnd > usageEnd
  ) {
    reject('INVALID_WINDOWS', 'Các cửa sổ bán/sử dụng không hợp lệ.');
  }
  if (!/^[0-9a-f]{64}$/.test(row.source_content_hash)) {
    reject('INVALID_SOURCE_HASH', 'source_content_hash phải là SHA-256 chữ thường.');
  }

  return issues;
}

function validateBranch(row: CsvRow): ValidationIssue[] {
  if (!row.province_code || VIETNAM_PROVINCE_CODES.includes(row.province_code)) {
    return [];
  }
  return [
    {
      externalId: row.external_id || '(missing)',
      errorCode: 'INVALID_PROVINCE_CODE',
      errorMessage: 'province_code của chi nhánh không hợp lệ.',
    },
  ];
}

export async function validateNormalizedCatalog(
  inputDirectory: string,
): Promise<ValidationResult> {
  const dataset = await loadNormalizedDataset(inputDirectory);
  const issues: ValidationIssue[] = [];
  const campaignKeys = new Set(
    dataset.campaigns.map((row) => keyOf(row.external_source, row.external_id)),
  );
  const brandKeys = new Set(
    dataset.brands.map((row) => keyOf(row.external_source, row.external_id)),
  );
  const categoryCodes = new Set(dataset.categories.map((row) => row.code));
  const branchKeys = new Set(
    dataset.branches.map((row) => keyOf(row.external_source, row.external_id)),
  );

  for (const duplicate of duplicateValues(
    dataset.campaigns.map((row) => keyOf(row.external_source, row.external_id)),
  )) {
    issues.push({
      externalId: duplicate,
      errorCode: 'DUPLICATE_CAMPAIGN',
      errorMessage: 'Campaign bị trùng external source/id trong CSV.',
    });
  }
  for (const campaign of dataset.campaigns) issues.push(...validateCampaign(campaign));
  for (const branch of dataset.branches) issues.push(...validateBranch(branch));

  if (dataset.branches.length > 10) {
    issues.push({
      externalId: '(dataset)',
      errorCode: 'BRANCH_LIMIT',
      errorMessage: `Dataset có ${dataset.branches.length} branches, vượt giới hạn 10.`,
    });
  }

  for (const relation of dataset.campaignBrands) {
    const campaignKey = keyOf(
      relation.campaign_external_source,
      relation.campaign_external_id,
    );
    const brandKey = keyOf(relation.brand_external_source, relation.brand_external_id);
    if (!campaignKeys.has(campaignKey) || !brandKeys.has(brandKey)) {
      issues.push({
        externalId: relation.campaign_external_id,
        errorCode: 'INVALID_BRAND_REFERENCE',
        errorMessage: 'campaign_brands tham chiếu campaign/brand không tồn tại.',
      });
    }
  }
  for (const relation of dataset.campaignCategories) {
    const campaignKey = keyOf(
      relation.campaign_external_source,
      relation.campaign_external_id,
    );
    if (!campaignKeys.has(campaignKey) || !categoryCodes.has(relation.category_code)) {
      issues.push({
        externalId: relation.campaign_external_id,
        errorCode: 'INVALID_CATEGORY_REFERENCE',
        errorMessage: 'campaign_categories tham chiếu campaign/category không tồn tại.',
      });
    }
  }
  for (const relation of dataset.campaignBranches) {
    const campaignKey = keyOf(
      relation.campaign_external_source,
      relation.campaign_external_id,
    );
    const branchKey = keyOf(relation.branch_external_source, relation.branch_external_id);
    if (!campaignKeys.has(campaignKey) || !branchKeys.has(branchKey)) {
      issues.push({
        externalId: relation.campaign_external_id,
        errorCode: 'INVALID_BRANCH_REFERENCE',
        errorMessage: 'campaign_branches tham chiếu campaign/branch không tồn tại.',
      });
    }
  }

  for (const campaign of dataset.campaigns) {
    const brandRelations = dataset.campaignBrands.filter(
      (row) => row.campaign_external_id === campaign.external_id,
    );
    const categoryRelations = dataset.campaignCategories.filter(
      (row) => row.campaign_external_id === campaign.external_id,
    );
    if (brandRelations.filter((row) => row.is_primary === 'true').length !== 1) {
      issues.push({
        externalId: campaign.external_id,
        errorCode: 'PRIMARY_BRAND',
        errorMessage: 'Mỗi campaign phải có đúng một primary brand.',
      });
    }
    if (categoryRelations.filter((row) => row.is_primary === 'true').length !== 1) {
      issues.push({
        externalId: campaign.external_id,
        errorCode: 'PRIMARY_CATEGORY',
        errorMessage: 'Mỗi campaign phải có đúng một primary category.',
      });
    }
  }

  const rejectedIds = new Set(
    issues.filter((issue) => issue.externalId !== '(dataset)').map((issue) => issue.externalId),
  );
  const validCampaigns = dataset.campaigns.filter(
    (campaign) => !rejectedIds.has(campaign.external_id),
  );
  const validIds = new Set(validCampaigns.map((campaign) => campaign.external_id));
  const validDataset: NormalizedDataset = {
    ...dataset,
    campaigns: validCampaigns,
    campaignBrands: dataset.campaignBrands.filter((row) =>
      validIds.has(row.campaign_external_id),
    ),
    campaignCategories: dataset.campaignCategories.filter((row) =>
      validIds.has(row.campaign_external_id),
    ),
    campaignBranches: dataset.campaignBranches.filter((row) =>
      validIds.has(row.campaign_external_id),
    ),
  };

  await writeCsv(
    join(inputDirectory, 'rejected', 'campaigns.csv'),
    ['external_id', 'error_code', 'error_message'],
    issues.map((issue) => ({
      external_id: issue.externalId,
      error_code: issue.errorCode,
      error_message: issue.errorMessage,
    })),
  );
  await writeJson(join(inputDirectory, 'validation-report.json'), {
    validatedAt: new Date().toISOString(),
    acceptedCampaigns: validCampaigns.length,
    rejectedCampaigns: rejectedIds.size,
    issueCount: issues.length,
    issues,
  });

  return { dataset: validDataset, issues };
}
