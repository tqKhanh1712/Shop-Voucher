const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    const regex = /(from\s+['"])(\.\.\/)((?:\.\.\/)*)((?:lib|components|context|styles|hooks|i18n)\b)/g;
    content = content.replace(regex, (match, p1, p2, p3, p4) => {
        changed = true;
        return `${p1}${p3}${p4}`;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Reverted ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

walkDir('d:/PJ_Workshop/Shop-Voucher/apps/web/app/[locale]');
