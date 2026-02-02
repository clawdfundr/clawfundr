const fs = require('fs');
const path = require('path');

// Add shebang to dist/index.js
const indexPath = path.join(__dirname, '../dist/index.js');
const content = fs.readFileSync(indexPath, 'utf-8');

if (!content.startsWith('#!/usr/bin/env node')) {
    const newContent = '#!/usr/bin/env node\n' + content;
    fs.writeFileSync(indexPath, newContent, 'utf-8');
    console.log('✓ Added shebang to dist/index.js');
}
