import {
  parseGiftpopBranchHtml,
  parseGiftpopProductHtml,
} from './giftpop.parser';

describe('Giftpop catalog parser', () => {
  const crawledAt = '2026-08-19T01:00:00.000Z';
  const sourceUrl = 'https://www.giftpop.vn/category/view/CB2604160001';

  it('extracts prices, source content, brands and normalized categories', () => {
    const html = `
      <a class="list-link" href="/brandshop/list?category_code=A104&brand_code=DOOKKI">Dookki</a>
      <a class="list-link" href="/brandshop/list?category_code=A116&brand_code=LIFE4CUTS">Life4Cuts</a>
      <section class="productInformation">
        <div class="leftInfor"><h2><img src="https://img.giftpop.vn/voucher/demo.png"></h2></div>
        <div class="rightInfor">
          <h4>Dookki x Life4Cuts - Voucher trải nghiệm</h4>
          <div class="name_info">
            <div class="price"><del>250.000đ</del><span class="pd-discount-badge">-20%</span>200.000<sup>đ</sup></div>
          </div>
          <div class="expiry_date">90 ngày (kể từ ngày mua)</div>
        </div>
      </section>
      <div class="Brand-Logo">
        <a href="/brandshop/list?brand_code=DOOKKI">
          <img src="https://img.giftpop.vn/brand/dookki.png">
          <div class="brand-detail"><p>Dookki <svg></svg></p></div>
        </a>
      </div>
      <div id="descrpition"><div class="contents"><p>Áp dụng cho buffet.</p><p>Tặng thêm một lượt chụp ảnh.</p></div></div>
      <div id="condition"><div class="contents"><ul><li>Không quy đổi tiền mặt.</li><li>Xuất trình mã khi thanh toán.</li></ul></div></div>
    `;

    const parsed = parseGiftpopProductHtml(html, sourceUrl, crawledAt);

    expect(parsed.product).toMatchObject({
      externalId: 'CB2604160001',
      originalPrice: 250000,
      salePrice: 200000,
      usageValidityDays: 90,
      description: 'Áp dụng cho buffet.\nTặng thêm một lượt chụp ảnh.',
      termsAndConditions: 'Không quy đổi tiền mặt.\nXuất trình mã khi thanh toán.',
      brandExternalIds: ['DOOKKI', 'LIFE4CUTS'],
      categoryExternalIds: ['A104', 'A116'],
    });
    expect(parsed.brands.map((brand) => brand.displayName)).toEqual([
      'Dookki',
      'Life4Cuts',
    ]);
    expect(parsed.branchRequest).toEqual({
      storeCode: 'DOOKKI',
      goodsId: 'CB2604160001',
    });
  });

  it('extracts branch cards and produces stable external ids', () => {
    const html = `
      <div class="pd-store-card"><h5>Dookki Nguyễn Huệ</h5><p>12 Nguyễn Huệ, Quận 1</p></div>
      <div class="pd-store-card"><h5>Dookki Cộng Hòa</h5><p>20 Cộng Hòa, Tân Bình</p></div>
      |10.776,106.700
    `;

    const firstRun = parseGiftpopBranchHtml(html, 'DOOKKI', sourceUrl, crawledAt);
    const secondRun = parseGiftpopBranchHtml(html, 'DOOKKI', sourceUrl, crawledAt);

    expect(firstRun).toHaveLength(2);
    expect(firstRun[0]).toMatchObject({
      name: 'Dookki Nguyễn Huệ',
      address: '12 Nguyễn Huệ, Quận 1',
      brandExternalId: 'DOOKKI',
    });
    expect(firstRun.map((branch) => branch.externalId)).toEqual(
      secondRun.map((branch) => branch.externalId),
    );
  });
});
