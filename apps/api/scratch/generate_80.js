const fs = require('fs');
const path = require('path');

function duplicateCatalog(sourceDir, targetDir, multiplier) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'raw'), { recursive: true });
  }

  const filesToCopy = ['brands.csv', 'branches.csv'];
  filesToCopy.forEach(file => {
    fs.copyFileSync(path.join(sourceDir, 'raw', file), path.join(targetDir, 'raw', file));
  });

  const productsCsv = fs.readFileSync(path.join(sourceDir, 'raw', 'products.csv'), 'utf8');
  const lines = productsCsv.split(/\r?\n/);
  
  const header = lines[0];
  const rows = lines.slice(1).filter(l => l.trim().length > 0);
  
  let newRows = [...rows];
  
  for (let i = 1; i < multiplier; i++) {
    const clonedRows = rows.map(row => {
      // row format: external_source,external_id,source_url,...
      // we need to safely replace external_id and title. 
      // but CSV has quoted strings. A simple replace on the first occurrence of ID is safer.
      const columns = row.split(',');
      const externalId = columns[1];
      const newExternalId = externalId + `_COPY${i}`;
      
      // Also slightly change the title if possible, which is usually after crawled_at
      return row.replace(externalId, newExternalId).replace('Phiếu quà tặng', `Phiếu quà tặng (Mẫu ${i})`);
    });
    newRows = newRows.concat(clonedRows);
  }
  
  // ensure exactly 80 items if we over-multiplied
  newRows = newRows.slice(0, 80);

  fs.writeFileSync(path.join(targetDir, 'raw', 'products.csv'), [header, ...newRows].join('\n'));
  console.log(`Đã tạo bộ dữ liệu mẫu với ${newRows.length} sản phẩm tại ${targetDir}`);
}

const source = path.join(__dirname, '..', 'data', 'catalog', 'giftpop', 'catalog-35-2026-09');
const target = path.join(__dirname, '..', 'data', 'catalog', 'giftpop', 'catalog-80-2026-09');

duplicateCatalog(source, target, 3);
