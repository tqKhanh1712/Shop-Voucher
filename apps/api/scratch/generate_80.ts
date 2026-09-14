import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

function duplicateCatalog(sourceDir: string, targetDir: string, targetCount: number) {
  const rawTargetDir = join(targetDir, 'raw');
  if (!existsSync(rawTargetDir)) {
    mkdirSync(rawTargetDir, { recursive: true });
  }

  const filesToCopy = ['brands.csv', 'branches.csv'];
  filesToCopy.forEach(file => {
    copyFileSync(join(sourceDir, 'raw', file), join(rawTargetDir, file));
  });

  const productsCsv = readFileSync(join(sourceDir, 'raw', 'products.csv'), 'utf8');
  const records = parse(productsCsv, { columns: true }) as Record<string, any>[];
  
  let newRecords = [...records];
  
  const MODIFIERS = [
    { prefix: 'Combo Cuối Tuần: ', suffix: '', priceMult: 1.5 },
    { prefix: '', suffix: ' - Khuyến Mãi Khai Trương', priceMult: 0.8 },
    { prefix: 'Gói VIP - ', suffix: '', priceMult: 2.0 },
    { prefix: '', suffix: ' (Dành Cho 2 Người)', priceMult: 1.8 },
    { prefix: 'Thẻ Quà Tặng Đặc Biệt: ', suffix: '', priceMult: 1.2 },
    { prefix: 'Voucher Giờ Vàng: ', suffix: '', priceMult: 0.7 },
    { prefix: '', suffix: ' (Tặng Kèm Nước)', priceMult: 1.1 },
    { prefix: 'Flash Sale: ', suffix: '', priceMult: 0.5 },
  ];

  let copyIndex = 1;
  while (newRecords.length < targetCount) {
    for (const record of records) {
      if (newRecords.length >= targetCount) break;
      const cloned = { ...record };
      const mod = MODIFIERS[newRecords.length % MODIFIERS.length];
      
      cloned.external_id = `${cloned.external_id}_V${newRecords.length}`;
      let baseTitle = cloned.title.replace(/^Phiếu quà tặng\s+/i, '');
      cloned.title = `${mod.prefix}${baseTitle}${mod.suffix}`;
      
      const origPrice = parseFloat(cloned.original_price || 0);
      const salePrice = parseFloat(cloned.sale_price || 0);
      
      cloned.original_price = (Math.round(origPrice * mod.priceMult / 1000) * 1000).toString();
      cloned.sale_price = (Math.round(salePrice * mod.priceMult / 1000) * 1000).toString();
      
      newRecords.push(cloned);
    }
    copyIndex++;
  }

  const outputCsv = stringify(newRecords, { header: true });
  writeFileSync(join(rawTargetDir, 'products.csv'), outputCsv);
  console.log(`Đã tạo thành công bộ dữ liệu ${newRecords.length} sản phẩm tại ${targetDir}`);
}

const source = join(__dirname, '..', 'data', 'catalog', 'giftpop', 'catalog-35-2026-09');
const target = join(__dirname, '..', 'data', 'catalog', 'giftpop', 'catalog-80-2026-09');

duplicateCatalog(source, target, 80);
