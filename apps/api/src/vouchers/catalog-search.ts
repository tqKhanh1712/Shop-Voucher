import { Prisma } from '@prisma/client';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';

const VIETNAMESE_DIACRITICS =
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';

export function normalizeCatalogKeyword(value?: string): string {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

const VIETNAMESE_ASCII = normalizeCatalogKeyword(VIETNAMESE_DIACRITICS);

const SEARCH_SYNONYMS: Record<string, string[]> = {
  // === NƯỚc UỐNG (chỉ chứa đồ uống, không lấn sang đồ ăn) ===
  'nuoc uong': ['ca phe', 'tra', 'tra sua', 'cafe', 'coffee', 'nuoc ep', 'sinh to', 'giai khat', 'beverage', 'drink', 'cocktail', 'mocktail'],
  'do uong': ['ca phe', 'tra', 'tra sua', 'cafe', 'coffee', 'nuoc ep', 'sinh to', 'giai khat', 'beverage', 'drink'],
  'giai khat': ['ca phe', 'tra', 'tra sua', 'cafe', 'coffee', 'nuoc ep', 'sinh to'],
  'ca phe': ['cafe', 'coffee', 'ca phe sua', 'espresso', 'cappuccino', 'latte', 'americano', 'highland', 'phuc long'],
  'tra sua': ['bobapop', 'gongcha', 'koi', 'tocotoco', 'milktea', 'tra tran chau', 'tra dao'],

  // === ĐỒ ĂN (chỉ chứa đồ ăn, không lấn sang đồ uống) ===
  'do an': ['nha hang', 'banh ngot', 'buffet', 'ga ran', 'pizza', 'mi', 'bun', 'pho', 'bbq', 'lau', 'an vat', 'com', 'mon an'],
  'thuc an': ['nha hang', 'banh ngot', 'buffet', 'ga ran', 'pizza', 'bbq', 'lau', 'food'],
  'am thuc': ['nha hang', 'buffet', 'quan an', 'mon au', 'mon a', 'mon viet'],
  'do an nhanh': ['ga ran', 'hamburger', 'burger', 'kfc', 'lotteria', 'texas', 'fast food'],
  'thuc an nhanh': ['ga ran', 'hamburger', 'burger', 'kfc', 'lotteria', 'fast food'],
  'mon viet': ['com tam', 'pho', 'bun bo', 'bun cha', 'banh mi', 'goi cuon'],
  'mon han': ['bbq', 'thit nuong', 'tokbokki', 'kimbap', 'kim chi', 'mi cay', 'korean', 'dookki'],
  'mon nhat': ['sushi', 'sashimi', 'udon', 'ramen', 'japanese'],
  'mon au': ['bit tet', 'beefsteak', 'pizza', 'pasta', 'mi y'],
  'banh ngot': ['bakery', 'banh kem', 'croissant', 'tiramisu', 'cake', 'tous les jours'],

  // === LÀM ĐẸP ===
  'lam dep': ['my pham', 'spa', 'toc', 'cham soc da', 'massage', 'salon', 'nail', 'skincare', 'cat toc', 'nhuom toc'],
  'lam toc': ['salon', 'cat toc', 'uon toc', 'nhuom toc', 'hair'],
  'cham soc da': ['spa', 'skincare', 'massage', 'mat na', 'kem duong'],

  // === SỨC KHỤE ===
  'suc khoe': ['nha khoa', 'kham benh', 'yoga', 'gym', 'phong kham', 'rang ham mat'],
  'nha khoa': ['rang', 'tay trang rang', 'implant', 'nieng rang', 'smile'],

  // === GIẢI TRÍ ===
  'giai tri': ['rap chieu phim', 'vui choi', 'xem phim', 'cinema', 'cgv', 'lotte cinema', 'bhd', 'karaoke', 'cong vien'],
  'xem phim': ['rap chieu phim', 'cinema', 'cgv', 'lotte cinema', 'bhd', 'galaxy'],
  'vui choi': ['khu vui choi', 'cong vien', 'bowling', 'truot bang'],

  // === MUA SẮM ===
  'mua sam': ['thoi trang', 'sieu thi', 'quan ao', 'giay dep', 'tui xach', 'phu kien'],
  'thoi trang': ['quan ao', 'giay dep', 'tui xach', 'ao thun', 'ao so mi', 'quan jean', 'vay', 'dam', 'dottie', 'canifa'],
  'sieu thi': ['cua hang tien loi', 'bach hoa', 'coopmart', 'winmart', 'bigc', 'lotte mart'],

  // === DI CHUYỂN ===
  'di lai': ['van chuyen', 'taxi', 'grab', 'gojek', 'xanh sm'],
  'du lich': ['khach san', 'resort', 've may bay', 'tour', 'hotel'],
};


function expandSearchKeyword(keyword: string): string[] {
  const synonyms = new Set<string>();
  for (const [key, values] of Object.entries(SEARCH_SYNONYMS)) {
    if (keyword.includes(key)) {
      values.forEach(v => synonyms.add(v));
    }
  }
  return Array.from(synonyms);
}

export interface CatalogSearchQueryRow {
  data: Prisma.JsonValue;
  total: number;
  facets: Prisma.JsonValue;
}

export interface CatalogCategoryFacet {
  code: string;
  name: string;
  campaignCount: number;
  children: CatalogCategoryFacet[];
}

export interface CatalogFacets {
  totalCampaignCount: number;
  categories: CatalogCategoryFacet[];
}

function normalizedSql(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`translate(lower(coalesce(${value}, '')), ${VIETNAMESE_DIACRITICS}, ${VIETNAMESE_ASCII})`;
}

function buildTimeFilter(
  validityStatus: PublicCatalogQueryDto['validityStatus'],
): Prisma.Sql {
  if (validityStatus === 'UPCOMING') {
    return Prisma.sql`AND vc.sale_start_time > NOW()`;
  }
  if (validityStatus === 'ALL') {
    return Prisma.sql`AND vc.sale_end_time >= NOW()`;
  }
  return Prisma.sql`
    AND vc.sale_start_time <= NOW()
    AND vc.sale_end_time >= NOW()
  `;
}

function buildOrdering(
  query: PublicCatalogQueryDto,
  hasKeyword: boolean,
): Prisma.Sql {
  if (query.sortDiscount === 'asc') {
    return Prisma.sql`c.discount_percent ASC, c.created_at DESC, c.campaign_id DESC`;
  }
  if (query.sortDiscount === 'desc') {
    return Prisma.sql`c.discount_percent DESC, c.created_at DESC, c.campaign_id DESC`;
  }
  if (query.sortPrice === 'asc') {
    return Prisma.sql`c.sale_price ASC, c.created_at DESC, c.campaign_id DESC`;
  }
  if (query.sortPrice === 'desc') {
    return Prisma.sql`c.sale_price DESC, c.created_at DESC, c.campaign_id DESC`;
  }
  if (hasKeyword) {
    return Prisma.sql`c.relevance DESC, c.created_at DESC, c.campaign_id DESC`;
  }
  return Prisma.sql`c.created_at DESC, c.campaign_id DESC`;
}

export function buildCatalogSearchQuery(
  query: PublicCatalogQueryDto,
  keywordVector: number[] | null = null,
): Prisma.Sql {
  const keyword = normalizeCatalogKeyword(query.keyword);
  const keywordTokens = keyword.split(' ').filter(Boolean);
  const synonyms = expandSearchKeyword(keyword);
  
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;
  const categoryCode = query.categoryCode?.trim();
  const ordering = buildOrdering(query, keywordTokens.length > 0);
  
  // Synonym chỉ match trên primary_search (title+brand+category+partner+branch).
  // Không dùng search_text (có cả description/điều khoản) để tránh false positive:
  // VD: TOUS les JOURS có chữ "trà" trong mô tả không có nghĩa nó là "đồ uống".
  const synonymSql = synonyms.length > 0 
    ? Prisma.sql`OR (${Prisma.join(synonyms.map((syn) => Prisma.sql`b.primary_search LIKE ${`%${syn}%`}`), ' OR ')})`
    : Prisma.empty;

  const vectorLiteral = keywordVector && keywordVector.length > 0
    ? `[${keywordVector.join(',')}]`
    : null;

  // Chỉ kích hoạt Semantic Search khi similarity thực sự cao (>= 0.58).
  // Dựa trên số liệu thực tế đo được: các cặp không liên quan thường cho 0.47-0.54,
  // còn các cặp liên quan rõ cho >= 0.58. Ngưỡng 0.58 loại sạch noise.
  const semanticConditionSql = vectorLiteral 
    ? Prisma.sql`OR (b.embedding IS NOT NULL AND (1 - (b.embedding <=> ${vectorLiteral}::vector)) >= 0.58)`
    : Prisma.empty;

  // tokenFilter chỉ dùng primary_search (title+brand+category+partner+branch) cho cả phrase và token match.
  // Description/terms điều khoản không được quyết định việc voucher có xuất hiện hay không.
  // VD: beFood có "bặt đồ ăn" trong description nhưng category là Vận chuyển → không lọt vào.
  const tokenFilter =
    keywordTokens.length > 1
      ? Prisma.sql`AND (
          b.primary_search LIKE ${`%${keyword}%`}
          OR (${Prisma.join(
            keywordTokens.map(
              (token) => Prisma.sql`b.primary_search LIKE ${`%${token}%`}`,
            ),
            ' AND ',
          )})
          ${synonymSql}
          ${semanticConditionSql}
        )`
      : keywordTokens.length === 1
        ? Prisma.sql`AND (
            b.primary_search LIKE ${`%${keyword}%`}
            ${synonymSql}
            ${semanticConditionSql}
          )`
        : Prisma.empty;
        
  // Hệ số 150: giảm từ 400 xuống để keyword vẫn chiếm ưu thế trong ranking.
  // similarity ~0.58 → +87 điểm; ~0.70 → +105 điểm. Không vượt mặt keyword score (min 100).
  const semanticScoreSql = vectorLiteral
    ? Prisma.sql`COALESCE((1 - (b.embedding <=> ${vectorLiteral}::vector)) * 150, 0)`
    : Prisma.sql`0`;

  const relevance =
    keywordTokens.length > 0
      ? Prisma.sql`
          (CASE
            WHEN b.title_search = ${keyword} THEN 1000
            ${
              synonyms.length > 0
                ? Prisma.sql`WHEN (${Prisma.join(
                    synonyms.map((syn) => Prisma.sql`b.category_search LIKE ${`%${syn}%`}`),
                    ' OR '
                  )}) THEN 900`
                : Prisma.empty
            }
            WHEN b.title_search LIKE ${`${keyword}%`} THEN 800
            WHEN b.title_search LIKE ${`%${keyword}%`} THEN 600
            ${
              synonyms.length > 0
                ? Prisma.sql`WHEN (${Prisma.join(
                    synonyms.map((syn) => Prisma.sql`b.title_search LIKE ${`%${syn}%`}`),
                    ' OR '
                  )}) THEN 550`
                : Prisma.empty
            }
            WHEN b.category_search LIKE ${`%${keyword}%`} THEN 500
            WHEN b.brand_search LIKE ${`%${keyword}%`} THEN 400
            WHEN b.partner_search LIKE ${`%${keyword}%`} THEN 300
            WHEN b.branch_search LIKE ${`%${keyword}%`} THEN 200
            WHEN b.body_search LIKE ${`%${keyword}%`} THEN 100
            ${
              synonyms.length > 0
                ? Prisma.sql`WHEN (${Prisma.join(
                    synonyms.map((syn) => Prisma.sql`b.search_text LIKE ${`%${syn}%`}`),
                    ' OR '
                  )}) THEN 50`
                : Prisma.empty
            }
            ELSE 50
          END) + (${semanticScoreSql})
        `
      : Prisma.sql`0`;
  const selectedCategoryFilter = categoryCode
    ? Prisma.sql`WHERE ${categoryCode} = ANY(c.facet_codes)`
    : Prisma.empty;
  const partnerFilter = query.partnerId
    ? Prisma.sql`AND vc.partner_id = ${query.partnerId}::uuid`
    : Prisma.empty;
  const legacyCategoryFilter = query.category
    ? Prisma.sql`AND vc.category = ${query.category}`
    : Prisma.empty;
  const minPriceFilter =
    query.minPrice !== undefined
      ? Prisma.sql`AND vc.sale_price >= ${query.minPrice}`
      : Prisma.empty;
  const maxPriceFilter =
    query.maxPrice !== undefined
      ? Prisma.sql`AND vc.sale_price <= ${query.maxPrice}`
      : Prisma.empty;
  const branchFilter = query.branchId
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM "Campaign_Branches" branch_filter
        WHERE branch_filter.campaign_id = vc.campaign_id
          AND branch_filter.branch_id = ${query.branchId}::uuid
      )`
    : Prisma.empty;
  const provinceFilter = query.provinceCode
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM "Campaign_Branches" province_relation
        JOIN "Branches" province_branch
          ON province_branch.partner_id = province_relation.partner_id
         AND province_branch.branch_id = province_relation.branch_id
        WHERE province_relation.campaign_id = vc.campaign_id
          AND province_branch.province_code = ${query.provinceCode}
      )`
    : Prisma.empty;
  const minDiscountFilter =
    query.minDiscount !== undefined
      ? Prisma.sql`AND (
          (vc.original_price - vc.sale_price) * 100 / NULLIF(vc.original_price, 0)
        ) >= ${query.minDiscount}`
      : Prisma.empty;

  const titleSearch = normalizedSql(Prisma.sql`vc.title`);
  const brandSearch = normalizedSql(Prisma.sql`
    (SELECT string_agg(brand.display_name, ' ')
     FROM "Campaign_Brands" campaign_brand
     JOIN "Catalog_Brands" brand ON brand.brand_id = campaign_brand.brand_id
     WHERE campaign_brand.campaign_id = vc.campaign_id)
  `);
  const categorySearch = normalizedSql(Prisma.sql`
    concat_ws(' ', vc.category,
      (SELECT string_agg(concat_ws(' ', category.name_vi, category.code, parent.name_vi, parent.code), ' ')
       FROM "Campaign_Categories" campaign_category
       JOIN "Voucher_Categories" category ON category.category_id = campaign_category.category_id
       LEFT JOIN "Voucher_Categories" parent ON parent.category_id = category.parent_id
       WHERE campaign_category.campaign_id = vc.campaign_id))
  `);
  const partnerSearch = normalizedSql(Prisma.sql`partner.company_name`);
  const branchSearch = normalizedSql(Prisma.sql`
    (SELECT string_agg(concat_ws(' ', branch.name, branch.address), ' ')
     FROM "Campaign_Branches" campaign_branch
     JOIN "Branches" branch
       ON branch.partner_id = campaign_branch.partner_id
      AND branch.branch_id = campaign_branch.branch_id
     WHERE campaign_branch.campaign_id = vc.campaign_id)
  `);
  const bodySearch = normalizedSql(
    Prisma.sql`concat_ws(' ', vc.description, vc.terms_and_conditions)`,
  );

  return Prisma.sql`
    WITH base AS (
      SELECT
        vc.campaign_id,
        vc.title,
        vc.category,
        vc.original_price,
        vc.sale_price,
        vc.capacity,
        vc.sold_quantity,
        vc.reserved_stock,
        vc.thumbnail_url,
        vc.sale_start_time,
        vc.sale_end_time,
        vc.created_at,
        vc.embedding,
        partner.company_name,
        ((vc.original_price - vc.sale_price) * 100 / NULLIF(vc.original_price, 0)) AS discount_percent,
        ${titleSearch} AS title_search,
        ${brandSearch} AS brand_search,
        ${categorySearch} AS category_search,
        ${partnerSearch} AS partner_search,
        ${branchSearch} AS branch_search,
        ${bodySearch} AS body_search,
        ARRAY(
          SELECT DISTINCT facet_code
          FROM (
            SELECT category.code AS facet_code
            FROM "Campaign_Categories" campaign_category
            JOIN "Voucher_Categories" category
              ON category.category_id = campaign_category.category_id
            WHERE campaign_category.campaign_id = vc.campaign_id
              AND category.is_active = TRUE
            UNION
            SELECT parent.code AS facet_code
            FROM "Campaign_Categories" campaign_category
            JOIN "Voucher_Categories" category
              ON category.category_id = campaign_category.category_id
            JOIN "Voucher_Categories" parent
              ON parent.category_id = category.parent_id
            WHERE campaign_category.campaign_id = vc.campaign_id
              AND category.is_active = TRUE
              AND parent.is_active = TRUE
          ) facet_codes
        ) AS facet_codes
      FROM "Voucher_Campaigns" vc
      JOIN "Partners" partner ON partner.partner_id = vc.partner_id
      JOIN "Users" partner_user ON partner_user.user_id = partner.partner_id
      WHERE vc.status::text = 'APPROVED'
        AND partner.account_status::text = 'ACTIVE'
        AND partner_user.status::text = 'ACTIVE'
        AND vc.capacity - vc.sold_quantity - vc.reserved_stock > 0
        ${buildTimeFilter(query.validityStatus)}
        ${partnerFilter}
        ${legacyCategoryFilter}
        ${minPriceFilter}
        ${maxPriceFilter}
        ${branchFilter}
        ${provinceFilter}
        ${minDiscountFilter}
    ), searchable AS (
      SELECT
        b.*,
        concat_ws(' ', b.title_search, b.brand_search, b.category_search,
          b.partner_search, b.branch_search) AS primary_search,
        concat_ws(' ', b.title_search, b.brand_search, b.category_search,
          b.partner_search, b.branch_search, b.body_search) AS search_text
      FROM base b
    ), candidates AS (
      SELECT b.*, ${relevance} AS relevance
      FROM searchable b
      WHERE TRUE ${tokenFilter}
    ), filtered AS (
      SELECT c.*
      FROM candidates c
      ${selectedCategoryFilter}
    ), facet_counts AS (
      SELECT facet_code AS code, COUNT(*)::int AS campaign_count
      FROM candidates candidate
      CROSS JOIN LATERAL unnest(candidate.facet_codes) facet_code
      GROUP BY facet_code
    ), ordered_page AS (
      SELECT
        c.*,
        ROW_NUMBER() OVER (ORDER BY ${ordering}) AS result_order
      FROM filtered c
      ORDER BY ${ordering}
      LIMIT ${limit}
      OFFSET ${offset}
    )
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM filtered), 0) AS total,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'campaignId', page.campaign_id,
            'title', page.title,
            'category', page.category,
            'originalPrice', page.original_price,
            'salePrice', page.sale_price,
            'capacity', page.capacity,
            'soldQuantity', page.sold_quantity,
            'reservedStock', page.reserved_stock,
            'thumbnailUrl', page.thumbnail_url,
            'saleStartTime', page.sale_start_time,
            'saleEndTime', page.sale_end_time,
            'partner', jsonb_build_object('companyName', page.company_name),
            'campaignBranches', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object('branch', jsonb_build_object(
                  'branchId', branch.branch_id,
                  'name', branch.name,
                  'address', branch.address
                )) ORDER BY branch.name
              )
              FROM "Campaign_Branches" relation
              JOIN "Branches" branch
                ON branch.partner_id = relation.partner_id
               AND branch.branch_id = relation.branch_id
              WHERE relation.campaign_id = page.campaign_id
            ), '[]'::jsonb),
            'primaryBrand', (
              SELECT jsonb_build_object(
                'displayName', brand.display_name,
                'logoUrl', brand.logo_url
              )
              FROM "Campaign_Brands" relation
              JOIN "Catalog_Brands" brand ON brand.brand_id = relation.brand_id
              WHERE relation.campaign_id = page.campaign_id
              ORDER BY relation.is_primary DESC, relation.created_at ASC
              LIMIT 1
            ),
            'primaryCategory', (
              SELECT jsonb_build_object(
                'nameVi', category.name_vi,
                'code', category.code,
                'parent', CASE WHEN parent.category_id IS NULL THEN NULL ELSE
                  jsonb_build_object('nameVi', parent.name_vi, 'code', parent.code)
                END
              )
              FROM "Campaign_Categories" relation
              JOIN "Voucher_Categories" category ON category.category_id = relation.category_id
              LEFT JOIN "Voucher_Categories" parent ON parent.category_id = category.parent_id
              WHERE relation.campaign_id = page.campaign_id
              ORDER BY relation.is_primary DESC, relation.created_at ASC
              LIMIT 1
            )
          ) ORDER BY page.result_order
        )
        FROM ordered_page page
      ), '[]'::jsonb) AS data,
      jsonb_build_object(
        'totalCampaignCount', (SELECT COUNT(*)::int FROM candidates),
        'categories', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', parent.code,
              'name', parent.name_vi,
              'campaignCount', COALESCE(parent_count.campaign_count, 0),
              'children', COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'code', child.code,
                    'name', child.name_vi,
                    'campaignCount', COALESCE(child_count.campaign_count, 0)
                  ) ORDER BY child.display_order, child.name_vi
                )
                FROM "Voucher_Categories" child
                LEFT JOIN facet_counts child_count ON child_count.code = child.code
                WHERE child.parent_id = parent.category_id
                  AND child.is_active = TRUE
              ), '[]'::jsonb)
            ) ORDER BY parent.display_order, parent.name_vi
          )
          FROM "Voucher_Categories" parent
          LEFT JOIN facet_counts parent_count ON parent_count.code = parent.code
          WHERE parent.parent_id IS NULL
            AND parent.is_active = TRUE
        ), '[]'::jsonb)
      ) AS facets
  `;
}
