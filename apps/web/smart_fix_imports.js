const fs = require('fs');
const path = require('path');

const rootDir = 'd:/PJ_Workshop/Shop-Voucher/apps/web';
const topLevelDirs = ['lib', 'components', 'context', 'styles', 'hooks', 'i18n'];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    const regex = /(from\s+['"])(\.\.[^'"]*)(['"])/g;
    content = content.replace(regex, (match, p1, p2, p3) => {
        const currentDir = path.dirname(filePath);
        const oldFileDir = currentDir.replace(path.sep + '[locale]', '');
        const intendedTarget = path.resolve(oldFileDir, p2);
        
        const relativeToRoot = path.relative(rootDir, intendedTarget).replace(/\\/g, '/');
        const isTopLevel = topLevelDirs.some(dir => relativeToRoot === dir || relativeToRoot.startsWith(dir + '/'));
        
        if (isTopLevel) {
            changed = true;
            return `${p1}@/${relativeToRoot}${p3}`;
        }
        
        return match;
    });

    // Handle imports without "from" e.g., import "../../styles/tokens.css"
    const regex2 = /(import\s+['"])(\.\.[^'"]*)(['"])/g;
    content = content.replace(regex2, (match, p1, p2, p3) => {
        const currentDir = path.dirname(filePath);
        const oldFileDir = currentDir.replace(path.sep + '[locale]', '');
        const intendedTarget = path.resolve(oldFileDir, p2);
        
        const relativeToRoot = path.relative(rootDir, intendedTarget).replace(/\\/g, '/');
        const isTopLevel = topLevelDirs.some(dir => relativeToRoot === dir || relativeToRoot.startsWith(dir + '/'));
        
        if (isTopLevel) {
            changed = true;
            return `${p1}@/${relativeToRoot}${p3}`;
        }
        
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Smart updated ${filePath}`);
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

walkDir(path.join(rootDir, 'app/[locale]'));
