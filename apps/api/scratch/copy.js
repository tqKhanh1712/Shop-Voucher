const fs = require('fs');
const src = 'd:/PJ_Workshop/Shop-Voucher/apps/api/scratch/voucher_taxonomy_full.md';
const dest = 'C:/Users/Acer/.gemini/antigravity-ide/brain/b2fe8af5-2a2a-4b22-8c7c-4c4754c3c1a2/voucher_taxonomy_review.md';
fs.copyFileSync(src, dest);
console.log('Copied to artifact');
