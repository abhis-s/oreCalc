const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../../dist');

if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log(`Cleaned: ${distDir}`);
} else {
    console.log(`Directory not found, no cleaning needed: ${distDir}`);
}
