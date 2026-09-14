const fs = require('fs');

const path = './src/vouchers/vouchers.service.spec.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/new VouchersService\(([^,]+),\s*([^)]+)\)/g, 'new VouchersService($1, $2, {} as any)');

fs.writeFileSync(path, content);
console.log('Fixed spec file.');
