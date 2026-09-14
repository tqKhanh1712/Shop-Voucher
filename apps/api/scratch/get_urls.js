const fs = require('fs');
const content = fs.readFileSync('apps/api/data/catalog/giftpop/catalog-35-2026-09/raw/products.csv', 'utf8');
const urls = [...content.matchAll(/https:\/\/www\.giftpop\.vn\/(?:brandshop|category)\/view\/[A-Za-z0-9_]+/g)].map(m => m[0]);
console.log([...new Set(urls)].join(','));
