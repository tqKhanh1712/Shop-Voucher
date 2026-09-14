import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import {
  GIFTPOP_CATEGORIES,
  GIFTPOP_SOURCE,
  ParsedGiftpopPage,
  RawGiftpopBrand,
  RawGiftpopBranch,
} from './catalog.types';

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const cleanText = ($: cheerio.CheerioAPI, selector: string): string => {
  const fragment = $(selector).first().clone();
  fragment.find('script, style, img, svg').remove();
  fragment.find('br').replaceWith('\n');
  fragment.find('p, li').each((_, element) => {
    $(element).append('\n');
  });

  return fragment
    .text()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

const parseMoney = (value: string): number => {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : Number.NaN;
};

const parseExternalId = (sourceUrl: string): string => {
  const pathname = new URL(sourceUrl).pathname.replace(/\/$/, '');
  return pathname.slice(pathname.lastIndexOf('/') + 1);
};

interface NavigationBrand {
  code: string;
  name: string;
  categoryCodes: Set<string>;
}

const parseNavigationBrands = ($: cheerio.CheerioAPI): Map<string, NavigationBrand> => {
  const brands = new Map<string, NavigationBrand>();

  $('a.list-link[href*="category_code="][href*="brand_code="]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    const url = new URL(href, 'https://www.giftpop.vn');
    const code = url.searchParams.get('brand_code')?.trim();
    const categoryCode = url.searchParams.get('category_code')?.trim();
    const name = $(element).text().replace(/\s+/g, ' ').trim();
    if (!code || !categoryCode || !name || !GIFTPOP_CATEGORIES[categoryCode]) return;

    const existing = brands.get(code) ?? { code, name, categoryCodes: new Set<string>() };
    existing.categoryCodes.add(categoryCode);
    brands.set(code, existing);
  });

  return brands;
};

const brandFromCode = (
  code: string,
  name: string,
  crawledAt: string,
  logoUrl?: string,
): RawGiftpopBrand => ({
  externalSource: GIFTPOP_SOURCE,
  externalId: code,
  displayName: name,
  logoUrl: logoUrl || `https://img.giftpop.vn/brand/logo/${encodeURIComponent(code)}.png`,
  sourceUrl: `https://www.giftpop.vn/brandshop/list?view&brand_code=${encodeURIComponent(code)}`,
  crawledAt,
});

export function parseGiftpopBranchHtml(
  html: string,
  brandExternalId: string,
  sourceUrl: string,
  crawledAt: string,
): RawGiftpopBranch[] {
  const $ = cheerio.load(html.split('|')[0]);
  const branches: RawGiftpopBranch[] = [];

  $('.pd-store-card').each((_, element) => {
    const name = $(element).find('h5').text().replace(/\s+/g, ' ').trim();
    const address = $(element).find('p').text().replace(/\s+/g, ' ').trim();
    if (!name || !address) return;

    const externalId = createHash('sha256')
      .update(`${normalizeForMatch(name)}|${normalizeForMatch(address)}`)
      .digest('hex');

    branches.push({
      externalSource: GIFTPOP_SOURCE,
      externalId,
      brandExternalId,
      name,
      address,
      sourceUrl,
      crawledAt,
    });
  });

  return branches;
}

export function parseGiftpopProductHtml(
  html: string,
  sourceUrl: string,
  crawledAt: string,
): Omit<ParsedGiftpopPage, 'branchCandidates'> & {
  branchRequest: { storeCode: string; goodsId: string };
} {
  const $ = cheerio.load(html);
  const externalId = parseExternalId(sourceUrl);
  const title = $('.rightInfor > h4').first().text().replace(/\s+/g, ' ').trim();
  const thumbnailUrl = $('.leftInfor h2 img').first().attr('src')?.trim() ?? '';

  const priceNode = $('.name_info .price').first().clone();
  const originalPrice = parseMoney(priceNode.find('del').text());
  priceNode.find('del, .pd-discount-badge, sup').remove();
  const salePrice = parseMoney(priceNode.text());

  const primaryBrandAnchor = $('.Brand-Logo > a').first();
  const primaryBrandUrl = new URL(
    primaryBrandAnchor.attr('href') ?? '',
    'https://www.giftpop.vn',
  );
  const primaryBrandCode = primaryBrandUrl.searchParams.get('brand_code')?.trim() ?? '';
  const primaryBrandName = primaryBrandAnchor
    .find('.brand-detail p')
    .first()
    .clone()
    .children('svg')
    .remove()
    .end()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  const primaryLogoUrl = primaryBrandAnchor.find('img').first().attr('src')?.trim();

  const navBrands = parseNavigationBrands($);
  const matchedBrandCodes = new Set<string>();
  if (primaryBrandCode) matchedBrandCodes.add(primaryBrandCode);
  const normalizedTitle = normalizeForMatch(title);

  for (const brand of navBrands.values()) {
    const normalizedBrandName = normalizeForMatch(brand.name);
    if (normalizedBrandName.length >= 4 && normalizedTitle.includes(normalizedBrandName)) {
      matchedBrandCodes.add(brand.code);
    }
  }

  const brands: RawGiftpopBrand[] = [];
  for (const brandCode of matchedBrandCodes) {
    const navigationBrand = navBrands.get(brandCode);
    brands.push(
      brandFromCode(
        brandCode,
        brandCode === primaryBrandCode
          ? primaryBrandName || navigationBrand?.name || brandCode
          : navigationBrand?.name || brandCode,
        crawledAt,
        brandCode === primaryBrandCode ? primaryLogoUrl : undefined,
      ),
    );
  }

  const categoryCodes = new Set<string>();
  for (const brandCode of matchedBrandCodes) {
    for (const categoryCode of navBrands.get(brandCode)?.categoryCodes ?? []) {
      categoryCodes.add(categoryCode);
    }
  }

  if (categoryCodes.size === 0) {
    categoryCodes.add('A102');
  }

  const validityText = $('.expiry_date').text().replace(/\s+/g, ' ');
  const validityMatch = validityText.match(/(\d+)\s*ngày/i);
  const usageValidityDays = validityMatch ? Number(validityMatch[1]) : null;
  const description = cleanText($, '#descrpition .contents');
  const termsAndConditions = cleanText($, '#condition .contents');

  if (!title || !primaryBrandCode || !primaryBrandName) {
    throw new Error(`Giftpop page ${sourceUrl} is missing product or brand information.`);
  }

  return {
    product: {
      externalSource: GIFTPOP_SOURCE,
      externalId,
      sourceUrl,
      crawledAt,
      title,
      description,
      termsAndConditions,
      originalPrice,
      salePrice,
      currency: 'VND',
      thumbnailUrl,
      usageValidityDays,
      brandExternalIds: Array.from(matchedBrandCodes),
      categoryExternalIds: Array.from(categoryCodes),
    },
    brands,
    branchRequest: {
      storeCode: primaryBrandCode,
      goodsId: externalId,
    },
  };
}
