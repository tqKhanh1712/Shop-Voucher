import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_GIFTPOP_PRODUCT_URLS,
  GIFTPOP_SOURCE,
  ParsedGiftpopPage,
  RawGiftpopBrand,
  RawGiftpopBranch,
  RawGiftpopProduct,
} from './catalog.types';
import { writeCsv, writeJson } from './csv-files';
import { parseGiftpopBranchHtml, parseGiftpopProductHtml } from './giftpop.parser';

const USER_AGENT = 'EC05-Voucher-System-Educational-Catalog-Crawler/1.0';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const MIN_REQUEST_INTERVAL_MS = 900;

interface CrawlOptions {
  outputDirectory: string;
  limit?: number;
  maxBranches?: number;
  urls?: string[];
}

interface CrawlError {
  source_url: string;
  stage: string;
  attempts: number;
  error_message: string;
  occurred_at: string;
}

class NonRetryableHttpError extends Error {}

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

class RateLimitedFetcher {
  private lastRequestAt = 0;

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await delay(MIN_REQUEST_INTERVAL_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  async text(url: string, options?: { allowNotFound?: boolean }): Promise<string> {
    let latestError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await this.throttle();
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) return response.text();
        if (options?.allowNotFound && response.status === 404) return '';
        if (response.status !== 429 && response.status < 500) {
          throw new NonRetryableHttpError(`HTTP ${response.status} for ${url}`);
        }
        latestError = new Error(`Retryable HTTP ${response.status} for ${url}`);
      } catch (error) {
        if (error instanceof NonRetryableHttpError) throw error;
        latestError = error;
      }

      if (attempt < MAX_ATTEMPTS) {
        await delay(500 * 2 ** (attempt - 1));
      }
    }

    throw latestError instanceof Error ? latestError : new Error(`Failed to fetch ${url}`);
  }
}

function assertRobotsAllows(robotsText: string, urls: string[]): void {
  const disallowed: string[] = [];
  let appliesToAll = false;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      appliesToAll = value === '*';
    } else if (field === 'disallow' && appliesToAll && value) {
      disallowed.push(value);
    }
  }

  for (const url of urls) {
    const pathname = new URL(url).pathname;
    const blockedBy = disallowed.find((rule) => pathname.startsWith(rule));
    if (blockedBy) {
      throw new Error(`robots.txt disallows ${pathname} via rule ${blockedBy}`);
    }
  }
}

function selectBalancedBranches(
  pages: ParsedGiftpopPage[],
  maxBranches: number,
): { branches: RawGiftpopBranch[]; selectedIds: Set<string> } {
  const uniqueBranches = new Map<string, RawGiftpopBranch>();
  for (const page of pages) {
    for (const branch of page.branchCandidates) {
      uniqueBranches.set(branch.externalId, branch);
    }
  }

  const groups = new Map<string, RawGiftpopBranch[]>();
  for (const branch of uniqueBranches.values()) {
    const group = groups.get(branch.brandExternalId) ?? [];
    group.push(branch);
    groups.set(branch.brandExternalId, group);
  }

  const selected: RawGiftpopBranch[] = [];
  const cursors = new Map<string, number>();
  let madeProgress = true;

  while (selected.length < maxBranches && madeProgress) {
    madeProgress = false;
    for (const [brandCode, branches] of groups) {
      const cursor = cursors.get(brandCode) ?? 0;
      if (cursor >= branches.length) continue;
      selected.push(branches[cursor]);
      cursors.set(brandCode, cursor + 1);
      madeProgress = true;
      if (selected.length >= maxBranches) break;
    }
  }

  return {
    branches: selected,
    selectedIds: new Set(selected.map((branch) => branch.externalId)),
  };
}

export async function crawlGiftpop(options: CrawlOptions): Promise<void> {
  const urls = (options.urls?.length ? options.urls : [...DEFAULT_GIFTPOP_PRODUCT_URLS]).slice(
    0,
    options.limit ?? 5,
  );
  const maxBranches = Math.max(0, options.maxBranches ?? 10);
  const fetcher = new RateLimitedFetcher();
  const crawledAt = new Date().toISOString();
  const errors: CrawlError[] = [];

  const robotsUrl = 'https://www.giftpop.vn/robots.txt';
  const robotsText = await fetcher.text(robotsUrl, { allowNotFound: true });
  assertRobotsAllows(robotsText, urls);

  const parsedPages: ParsedGiftpopPage[] = [];
  for (const sourceUrl of urls) {
    try {
      const html = await fetcher.text(sourceUrl);
      const parsed = parseGiftpopProductHtml(html, sourceUrl, crawledAt);
      const branchUrl = new URL('/HashTag/list_view', 'https://www.giftpop.vn');
      branchUrl.searchParams.set('store_code', parsed.branchRequest.storeCode);
      branchUrl.searchParams.set('store_city', '');
      branchUrl.searchParams.set('store_district', '');
      branchUrl.searchParams.set('goods_id', parsed.branchRequest.goodsId);

      let branchCandidates: RawGiftpopBranch[] = [];
      if (maxBranches > 0) {
        try {
          const branchHtml = await fetcher.text(branchUrl.toString());
          branchCandidates = parseGiftpopBranchHtml(
            branchHtml,
            parsed.branchRequest.storeCode,
            sourceUrl,
            crawledAt,
          );
        } catch (error) {
          errors.push({
            source_url: sourceUrl,
            stage: 'branches',
            attempts: MAX_ATTEMPTS,
            error_message: error instanceof Error ? error.message : String(error),
            occurred_at: new Date().toISOString(),
          });
        }
      }

      parsedPages.push({
        product: parsed.product,
        brands: parsed.brands,
        branchCandidates,
      });
    } catch (error) {
      errors.push({
        source_url: sourceUrl,
        stage: 'product',
        attempts: MAX_ATTEMPTS,
        error_message: error instanceof Error ? error.message : String(error),
        occurred_at: new Date().toISOString(),
      });
    }
  }

  if (parsedPages.length === 0) {
    throw new Error('Giftpop crawl produced no valid product pages.');
  }

  const { branches, selectedIds } = selectBalancedBranches(parsedPages, maxBranches);
  const products: RawGiftpopProduct[] = parsedPages.map((page) => ({
    ...page.product,
    branchExternalIds: page.branchCandidates
      .filter((branch) => selectedIds.has(branch.externalId))
      .map((branch) => branch.externalId),
  }));
  const brands = new Map<string, RawGiftpopBrand>();
  for (const page of parsedPages) {
    for (const brand of page.brands) brands.set(brand.externalId, brand);
  }

  const rawDirectory = join(options.outputDirectory, 'raw');
  await mkdir(rawDirectory, { recursive: true });
  await writeCsv(
    join(rawDirectory, 'products.csv'),
    [
      'external_source',
      'external_id',
      'source_url',
      'crawled_at',
      'title',
      'description',
      'terms_and_conditions',
      'original_price',
      'sale_price',
      'currency',
      'thumbnail_url',
      'usage_validity_days',
      'brand_external_ids',
      'category_external_ids',
      'branch_external_ids',
    ],
    products.map((product) => ({
      external_source: product.externalSource,
      external_id: product.externalId,
      source_url: product.sourceUrl,
      crawled_at: product.crawledAt,
      title: product.title,
      description: product.description,
      terms_and_conditions: product.termsAndConditions,
      original_price: product.originalPrice,
      sale_price: product.salePrice,
      currency: product.currency,
      thumbnail_url: product.thumbnailUrl,
      usage_validity_days: product.usageValidityDays ?? '',
      brand_external_ids: product.brandExternalIds.join('|'),
      category_external_ids: product.categoryExternalIds.join('|'),
      branch_external_ids: product.branchExternalIds.join('|'),
    })),
  );
  await writeCsv(
    join(rawDirectory, 'brands.csv'),
    ['external_source', 'external_id', 'display_name', 'logo_url', 'source_url', 'crawled_at'],
    Array.from(brands.values()).map((brand) => ({
      external_source: brand.externalSource,
      external_id: brand.externalId,
      display_name: brand.displayName,
      logo_url: brand.logoUrl,
      source_url: brand.sourceUrl,
      crawled_at: brand.crawledAt,
    })),
  );
  await writeCsv(
    join(rawDirectory, 'branches.csv'),
    [
      'external_source',
      'external_id',
      'brand_external_id',
      'name',
      'address',
      'source_url',
      'crawled_at',
    ],
    branches.map((branch) => ({
      external_source: branch.externalSource,
      external_id: branch.externalId,
      brand_external_id: branch.brandExternalId,
      name: branch.name,
      address: branch.address,
      source_url: branch.sourceUrl,
      crawled_at: branch.crawledAt,
    })),
  );
  await writeCsv(
    join(options.outputDirectory, 'crawl-errors.csv'),
    ['source_url', 'stage', 'attempts', 'error_message', 'occurred_at'],
    errors.map((error) => ({ ...error })),
  );
  await writeJson(join(options.outputDirectory, 'manifest.json'), {
    source: GIFTPOP_SOURCE,
    robotsUrl,
    robotsPolicy: robotsText ? 'checked' : 'not-published-http-404',
    authorizationBasis: 'Non-commercial educational permission confirmed by the project owner.',
    crawledAt,
    requestedProducts: urls.length,
    acceptedProducts: products.length,
    selectedBranches: branches.length,
    errors: errors.length,
    rateLimitMilliseconds: MIN_REQUEST_INTERVAL_MS,
    timeoutMilliseconds: REQUEST_TIMEOUT_MS,
    maxAttempts: MAX_ATTEMPTS,
  });
}
