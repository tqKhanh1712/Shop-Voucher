import {
  buildCatalogSearchQuery,
  normalizeCatalogKeyword,
} from './catalog-search';

describe('catalog search query', () => {
  it('normalizes Vietnamese accents and repeated whitespace', () => {
    expect(normalizeCatalogKeyword('  Cà   phê Đậm Đà  ')).toBe(
      'ca phe dam da',
    );
  });

  it('searches multi-word keywords as a phrase or across primary fields', () => {
    const query = buildCatalogSearchQuery({
      keyword: 'Thời trang',
      validityStatus: 'ALL',
    });

    expect(query.sql).toContain('b.search_text LIKE');
    expect(query.sql).toContain('b.primary_search LIKE');
    expect(query.values).toContain('%thoi trang%');
  });

  it('keeps category facets independent from the selected category', () => {
    const query = buildCatalogSearchQuery({
      categoryCode: 'SHOPPING_RETAIL',
    });

    expect(query.sql).toContain('FROM candidates candidate');
    expect(query.sql).toContain('= ANY(c.facet_codes)');
  });
});
