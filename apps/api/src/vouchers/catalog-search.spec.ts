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

  it('combines text search with semantic score if provided', () => {
    const query = buildCatalogSearchQuery({
      keyword: 'thoi trang adidas',
      validityStatus: 'ALL',
    });

    expect(query.sql).toContain('b.search_text ~*');
    expect(query.sql).toContain('b.primary_search ~*');
    expect(query.values).toContain('\\yadidas\\y');
  });

  it('keeps category facets independent from the selected category', () => {
    const query = buildCatalogSearchQuery({
      categoryCode: 'SHOPPING_RETAIL',
    });

    expect(query.sql).toContain('FROM candidates candidate');
    expect(query.sql).toContain('= ANY(c.facet_codes)');
  });
});
